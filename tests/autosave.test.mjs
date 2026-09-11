import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutosaver,createDraftStore} from '../project-store.js';
import {validateProject} from '../layout.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const project=()=>({format:'wallstory',version:1,state:{wall:{w:360,h:108},unit:'in',gap:2,margin:4,center:57,style:'balanced',photo:'data:image/jpeg;base64,YWJj',rawPhoto:'data:image/jpeg;base64,ZGVm',corners:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],items:[{id:'one',name:'Family',shape:'rectangle',w:12,h:16,x:40,y:20,rotation:90,color:'#123456',image:'data:image/png;base64,YWJj'}]},view:{tab:'layout',planView:true,showMeasurements:false,showGrid:true,snap:false}});

test('autosave recovers wall dimensions, images, corners, piece positions, and view options',async()=>{
 let disk;
 const saver=createAutosaver(async value=>{disk=structuredClone(value)},()=>{});
 const input=project();saver.queue(input);
 assert.equal(await saver.flush(),true);
 assert.deepEqual(validateProject(disk),input.state);
 assert.deepEqual(disk.view,input.view);
 assert.equal(saver.isSaved(),true);
});
test('quick edits are serialized and the last edit wins before update can reload',async()=>{
 const first=deferred();const writes=[];
 const saver=createAutosaver(async p=>{writes.push(p);if(writes.length===1)await first.promise},()=>{});
 saver.queue('first');saver.queue('middle');saver.queue('last');
 let finished=false;const flush=saver.flush().then(ok=>{finished=true;return ok});
 await tick();assert.equal(finished,false);assert.equal(saver.isSaved(),false);
 first.resolve();assert.equal(await flush,true);assert.deepEqual(writes,['first','last']);
 assert.equal(saver.isSaved(),true);
});
test('a failed write is never marked saved; retry persists the newest pending edit',async()=>{
 let fail=true;const writes=[],statuses=[];
 const saver=createAutosaver(async p=>{if(fail)throw Error('Quota exceeded');writes.push(p)},status=>statuses.push(status));
 saver.queue('photo wall');assert.equal(await saver.flush(),false);assert.equal(saver.isSaved(),false);
 assert.equal(statuses.at(-1),'error');
 saver.queue('newer wall');assert.equal(await saver.flush(),false);
 fail=false;assert.equal(await saver.flush(),true);assert.deepEqual(writes,['newer wall']);
});
test('project recovery accepts all wall margins supported by the editor',()=>{
 const p=project();p.state.wall={w:1200,h:1200};p.state.margin=600;
 assert.equal(validateProject(p).margin,600);
 p.state.margin=601;assert.throws(()=>validateProject(p));
});

// A controlled transaction boundary verifies that request success alone cannot
// claim a save, and lets abort/conflict cases be tested without a browser.
function storageHarness(){
 let record=null,hold=false,putFailure=false;
 const held=[],db={objectStoreNames:{contains:()=>true},close(){},transaction(){
  const tx={abort(){queueMicrotask(()=>tx.onabort?.())},objectStore(){return {
   get(){const request={};queueMicrotask(()=>{request.result=structuredClone(record);request.onsuccess?.();if(!tx.aborted){if(hold&&tx.next)held.push(tx);else queueMicrotask(()=>complete(tx))}});return request},
   put(value){if(putFailure)throw Error('Cannot clone');tx.next=structuredClone(value)}
  }}};
  tx.abort=()=>{tx.aborted=true;queueMicrotask(()=>tx.onabort?.())};return tx;
 }};
 function complete(tx){if(tx.aborted)return;if(tx.next)record=tx.next;tx.oncomplete?.()}
 return {indexedDB:{open(){const request={};queueMicrotask(()=>{request.result=db;request.onsuccess?.()});return request}},set hold(v){hold=v},set putFailure(v){putFailure=v},get record(){return record},complete(){complete(held.shift())}};
}
test('IndexedDB draft save acknowledges only transaction completion',async()=>{
 const h=storageHarness();const store=createDraftStore(h.indexedDB,'/wallstory/');
 assert.equal(await store.load(),null);h.hold=true;
 let complete=false;const write=store.write(project()).then(()=>complete=true);
 await tick();assert.equal(complete,false);assert.equal(h.record,null);
 h.complete();await write;assert.equal(complete,true);
 const reopened=createDraftStore(h.indexedDB,'/wallstory/');
 assert.deepEqual(await reopened.load(),project());
});
test('another window cannot silently overwrite a newer saved draft',async()=>{
 const h=storageHarness();const a=createDraftStore(h.indexedDB,'/wallstory/'),b=createDraftStore(h.indexedDB,'/wallstory/');
 await a.load();await b.load();await a.write(project());
 await assert.rejects(b.write({wrong:'stale wall'}),error=>error.name==='DraftConflictError');
 assert.deepEqual(h.record.project,project());
});
test('a storage exception aborts the save and preserves the existing draft',async()=>{
 const h=storageHarness();const store=createDraftStore(h.indexedDB,'/wallstory/');
 await store.load();await store.write(project());h.putFailure=true;
 await assert.rejects(store.write({bad:'data'}));assert.deepEqual(h.record.project,project());
});
