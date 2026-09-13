import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const pwaCode=await readFile(new URL('../pwa.js',import.meta.url),'utf8');
const workerCode=await readFile(new URL('../sw.js',import.meta.url),'utf8');
const release=workerCode.match(/const VERSION = '([^']+)'/)[1];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const settle=async()=>{await tick();await tick()};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};

function pwaHarness(save){
 const log=[],nodes={};
 for(const id of ['check-updates','update-notice','apply-update','update-message','planner','header-actions'])nodes[id]=Object.assign(new EventTarget(),{hidden:id==='update-notice',disabled:false,inert:false,textContent:''});
 const document=Object.assign(new EventTarget(),{readyState:'complete',visibilityState:'visible',getElementById:id=>nodes[id]||null,querySelector:()=>nodes['header-actions']});
 const serviceWorker=new EventTarget();
 const registration=Object.assign(new EventTarget(),{installing:null,waiting:null,async update(){}});
 const makeWorker=version=>({postMessage(message,ports){
  if(message.type==='GET_VERSION')ports[0].postMessage({version});
  if(message.type==='SKIP_WAITING'){
   log.push('activate');registration.waiting=null;serviceWorker.controller=makeWorker(version);
   serviceWorker.dispatchEvent(new Event('controllerchange'));
  }
 }});
 serviceWorker.controller=makeWorker(release);
 registration.waiting=makeWorker('next-release');
 serviceWorker.register=async()=>registration;serviceWorker.ready=Promise.resolve(registration);
 const window=Object.assign(new EventTarget(),{isSecureContext:true,wallstoryProject:{async prepareForUpdate(){log.push('save-start');await save();log.push('saved')}}});
 class Channel{constructor(){this.port1={close(){}};this.port2={postMessage:data=>queueMicrotask(()=>this.port1.onmessage?.({data}))}}}
 vm.runInNewContext(pwaCode,{document,window,navigator:{serviceWorker},location:{reload(){log.push('reload')}},MessageChannel:Channel,Date,Promise,setTimeout,clearTimeout,setInterval:()=>0});
 return {log,nodes,async click(){nodes['apply-update'].dispatchEvent(new Event('click'));await settle()},activateElsewhere(){serviceWorker.controller=makeWorker('next-release');registration.waiting=null;serviceWorker.dispatchEvent(new Event('controllerchange'))}};
}
test('Update available waits for autosave, then activates and reloads',async()=>{
 const gate=deferred();const h=pwaHarness(()=>gate.promise);await settle();
 assert.equal(h.nodes['update-notice'].hidden,false);
 await h.click();assert.deepEqual(h.log,['save-start']);assert.equal(h.nodes.planner.inert,true);
 gate.resolve();await settle();
 assert.deepEqual(h.log,['save-start','saved','activate','save-start','saved','reload']);
});
test('a failed autosave keeps the current app and design open',async()=>{
 const h=pwaHarness(async()=>{throw Error('Storage full')});await settle();await h.click();
 assert.deepEqual(h.log,['save-start']);assert.equal(h.nodes.planner.inert,false);
 assert.equal(h.nodes['apply-update'].disabled,false);assert.match(h.nodes['update-message'].textContent,/Storage full/);
});
test('an update activated in another window never forces this window to reload',async()=>{
 const h=pwaHarness(async()=>{});await settle();h.activateElsewhere();await settle();
 assert.deepEqual(h.log,[]);assert.equal(h.nodes['update-notice'].hidden,false);
});

function workerHarness(failInstall=false){
 const handlers={},stores=new Map(),deleted=[];let skipped=0;
 const scope='https://example.test/wallstory/';
 const prefix='wallstory-/wallstory/-';
 const cache=()=>({files:new Map(),async addAll(requests){if(failInstall)throw Error('Missing asset');for(const request of requests)this.files.set(request.url,new Response('complete-release'))},async match(key){return this.files.get(key)?.clone()},async put(key,response){this.files.set(key,response)}});
 stores.set(prefix+'older',cache());stores.set('another-app-cache',cache());
 const caches={async open(name){if(!stores.has(name))stores.set(name,cache());return stores.get(name)},async keys(){return [...stores.keys()]},async delete(name){deleted.push(name);return stores.delete(name)}};
 const self={registration:{scope},clients:{async claim(){}},addEventListener:(name,fn)=>handlers[name]=fn,async skipWaiting(){skipped++}};
 vm.runInNewContext(workerCode,{self,caches,URL,Request,Response,Promise,fetch:async()=>{throw Error('Offline')}});
 return {handlers,stores,deleted,get skipped(){return skipped},async event(name,extra={}){let promise;handlers[name]({...extra,waitUntil:p=>promise=p,respondWith:p=>promise=p});return await promise}};
}
test('complete release downloads without auto-activating; explicit update activates it',async()=>{
 const h=workerHarness();await h.event('install');assert.equal(h.skipped,0);
 await h.event('message',{data:{type:'SKIP_WAITING'}});assert.equal(h.skipped,1);
 await h.event('activate');assert.deepEqual(h.deleted,['wallstory-/wallstory/-older']);
 assert.equal(h.stores.has('another-app-cache'),true);
 const response=await h.event('fetch',{request:new Request('https://example.test/wallstory/app.js')});
 assert.equal(await response.text(),'complete-release');
});
test('failed release download leaves the old app cache intact',async()=>{
 const h=workerHarness(true);await assert.rejects(h.event('install'));
 assert.equal(h.skipped,0);assert.equal(h.stores.has('wallstory-/wallstory/-older'),true);
 assert.equal(h.stores.has('wallstory-/wallstory/-'+release),false);
});
