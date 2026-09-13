// DOM event harness for the actual app and studio modules. This does not render
// CSS or emulate native fullscreen; visual/device testing remains separate.
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import * as layout from '../layout.js';
import * as math from '../studio-math.js';
import {createAutosaver} from '../project-store.js';
const decode=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
class Element{
 constructor(tag='div',attrs={}){this.tagName=tag.toUpperCase();this.attrs={...attrs};this.children=[];this.parentNode=null;this.events={};this.style={setProperty(name,value){this[name]=value}};this.capture=new Set();this._text='';this._value=attrs.value;this._hidden='hidden' in attrs;this._checked='checked' in attrs;this.inert='inert' in attrs;this.scrollTop=0;this.disabled='disabled' in attrs;this.readOnly=false;this.open=false;
  this.dataset=new Proxy({}, {get:(_,key)=>this.attrs['data-'+key.replace(/[A-Z]/g,x=>'-'+x.toLowerCase())],set:(_,key,value)=>{this.attrs['data-'+key.replace(/[A-Z]/g,x=>'-'+x.toLowerCase())]=String(value);return true}});
  this.classList={contains:name=>(this.attrs.class||'').split(/\s+/).includes(name),toggle:(name,force)=>{const s=new Set((this.attrs.class||'').split(/\s+/).filter(Boolean));const add=force??!s.has(name);add?s.add(name):s.delete(name);this.attrs.class=[...s].join(' ');return add},add:name=>this.classList.toggle(name,true),remove:name=>this.classList.toggle(name,false)};
 }
 get id(){return this.attrs.id||''}get parentElement(){return this.parentNode}get nextSibling(){return this.parentNode?.children[this.parentNode.children.indexOf(this)+1]||null}
 get value(){return this._value??(this.tagName==='SELECT'?this.children.find(n=>n.tagName==='OPTION')?.value:'')??''}set value(v){this._value=String(v)}
 get checked(){return this._checked}set checked(v){this._checked=!!v}get hidden(){return this._hidden}set hidden(v){this._hidden=!!v}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('')}set textContent(v){this._text=String(v);this.children=[]}
 get innerHTML(){return this._html||''}set innerHTML(value){this.children=[];this._text='';this._html=value;for(const n of parse(value))this.append(n)}
 get document(){let n=this;while(n.parentNode)n=n.parentNode;return n._document||n}
 append(node){node.remove();node.parentNode=this;this.children.push(node)}appendChild(node){this.append(node)}
 insertBefore(node,before){node.remove();const i=this.children.indexOf(before);node.parentNode=this;if(i<0)this.children.push(node);else this.children.splice(i,0,node)}
 remove(){if(this.parentNode)this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null}
 setAttribute(name,value){this.attrs[name]=String(value);if(name==='value')this.value=value}getAttribute(name){return this.attrs[name]??null}removeAttribute(name){delete this.attrs[name]}
 matches(selector){selector=selector.trim();if(selector==='dialog[open]')return this.tagName==='DIALOG'&&this.open;
  const tag=selector.match(/^[a-zA-Z][\w-]*/)?.[0];if(tag&&this.tagName!==tag.toUpperCase())return false;
  const id=selector.match(/#([\w-]+)/)?.[1];if(id&&this.id!==id)return false;
  for(const c of selector.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(c[1]))return false;
  for(const a of selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)){if(!(a[1] in this.attrs))return false;if(a[2]!==undefined&&this.attrs[a[1]]!==a[2])return false}
  return true;
 }
 querySelectorAll(selector){const results=[];const alternatives=selector.split(',').map(s=>s.trim());const check=n=>alternatives.some(s=>{const parts=s.split(/\s+(?![^[]*\])/);if(!n.matches(parts.at(-1)))return false;let p=n.parentNode;for(let i=parts.length-2;i>=0;i--){while(p&&!p.matches(parts[i]))p=p.parentNode;if(!p)return false;p=p.parentNode}return true});const walk=n=>{for(const c of n.children){if(check(c))results.push(c);walk(c)}};walk(this);return results}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null}closest(selector){let n=this;while(n){if(selector.split(',').some(s=>n.matches(s)))return n;n=n.parentNode}return null}
 addEventListener(type,fn,options){(this.events[type]??=[]).push({fn,capture:options===true||options?.capture})}
 dispatchEvent(event){event.target??=this;event.preventDefault??=()=>{event.defaultPrevented=true};event.stopPropagation??=()=>{event.stopped=true};const path=[];for(let n=this;n;n=n.parentNode)path.push(n);for(const n of path.slice().reverse()){for(const h of n.events[event.type]||[])if(h.capture)h.fn(event);if(event.stopped)return true}for(const n of path){for(const h of n.events[event.type]||[])if(!h.capture)h.fn(event);if(event.type==='click'&&typeof n.onclick==='function')n.onclick(event);if(event.stopped||event.bubbles===false)break}return !event.defaultPrevented}
 click(){if(!this.disabled)this.dispatchEvent({type:'click'})}focus(){this.document.activeElement=this}blur(){this.document.activeElement=null}scrollIntoView(){}
 showModal(){this.open=true;this.attrs.open=''}close(){this.open=false;delete this.attrs.open}
 insertAdjacentHTML(where,html){const nodes=parse(html);if(where==='afterend'){const next=this.nextSibling;for(const n of nodes)this.parentNode.insertBefore(n,next)}else for(const n of nodes)this.append(n)}
 getBoundingClientRect(){if(this.id==='studio-viewport')return {left:0,top:52,width:800,height:440};if(this.id==='wall'){const studio=this.closest('#studio-world');if(studio){const zoom=Number(studio.style.transform?.match(/scale\(([^)]+)\)/)?.[1]||1),w=(parseFloat(studio.style.width)||700)*zoom,h=(parseFloat(studio.style.height)||400)*zoom;return {left:0,top:0,width:w,height:h}}return {left:0,top:0,width:720,height:480}}return {left:0,top:0,width:300,height:200}}
 getClientRects(){for(let n=this;n;n=n.parentNode)if(n.hidden)return [];return [this.getBoundingClientRect()]}
 setPointerCapture(id){this.capture.add(id)}hasPointerCapture(id){return this.capture.has(id)}releasePointerCapture(id){this.capture.delete(id)}
}
function parse(html){const root=new Element('fragment'),stack=[root],voids=new Set(['meta','link','input','img','br','hr','source']);for(const m of html.matchAll(/<\/?[a-zA-Z][^>]*>|[^<]+/g)){const token=m[0];if(!token.startsWith('<')){stack.at(-1)._text+=decode(token);continue}const tag=token.match(/^<\/?([\w-]+)/)[1].toLowerCase();if(token.startsWith('</')){for(let i=stack.length-1;i>0;i--)if(stack[i].tagName===tag.toUpperCase()){stack.length=i;break}continue}const attrs={};const tail=token.slice(token.indexOf(tag)+tag.length,-1);for(const a of tail.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[a[1]]=decode(a[2]??a[3]??a[4]??'');const node=new Element(tag,attrs);stack.at(-1).append(node);if(!voids.has(tag)&&!token.endsWith('/>'))stack.push(node)}return [...root.children]}
export async function appHarness(saved=null){
 const doc=new Element('document');doc._document=doc;doc.activeElement=null;doc.visibilityState='visible';doc.readyState='complete';doc.getElementById=id=>doc.querySelector('#'+id);doc.createElement=tag=>new Element(tag);
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');for(const node of parse(html))doc.append(node);doc.body=doc.querySelector('body');doc.documentElement=doc.querySelector('html');
 const window=new Element('window');window.indexedDB={};const savedProjects=[];let current=saved;
 const timers=new Set();function setTimer(fn,delay){const timer=setTimeout(fn,delay);timer.unref();timers.add(timer);return timer}
 const context=vm.createContext({...layout,...math,createAutosaver,createDraftStore:()=>({load:async()=>current,write:async value=>{current=structuredClone(value);savedProjects.push(current)}}),document:doc,window,screen:{orientation:{}},location:{href:'https://example.test/wallstory/'},innerWidth:1000,innerHeight:650,crypto:webcrypto,URL,Blob,Image:class{},CSS:{escape:s=>s},ResizeObserver:class{observe(){}},MutationObserver:class{observe(){}},requestAnimationFrame:fn=>setImmediate(fn),cancelAnimationFrame:clearImmediate,setTimeout:setTimer,clearTimeout,console});
 const studio=(await readFile(new URL('../studio.js',import.meta.url),'utf8')).replace(/^import .*;\n/,'').replace('export function createStudio','function createStudio');
 const app=(await readFile(new URL('../app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 vm.runInContext(`const createStudio=(()=>{${studio}\nreturn createStudio})();\n${app}`,context);
 await new Promise(resolve=>setImmediate(resolve));
 return {doc,window,savedProjects,get state(){return vm.runInContext('state',context)},node:id=>doc.getElementById(id),event:(id,type,props={})=>doc.getElementById(id).dispatchEvent({type,...props}),settle:()=>new Promise(resolve=>setImmediate(resolve)),dispose:()=>{for(const timer of timers)clearTimeout(timer)}};
}
