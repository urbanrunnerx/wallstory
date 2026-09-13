import test from 'node:test';
import assert from 'node:assert/strict';
import {hangingBasis,cloneHanging,validateHanging,hangingStatus,reconcileHanging,viewPoint,wallFasteners} from '../hanging.js';
import {validateProject} from '../layout.js';
import {buildHangingGuide,hangingMap} from '../hanging-guide.js';
import {appHarness} from './studio-harness.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const frame=(extra={})=>({id:'test-frame',name:'Measured frame',shape:'rectangle',w:10,h:12,x:20,y:12,rotation:0,color:'#453c32',image:null,...extra});
const measured=(p,points=[{x:2.5,y:1},{x:7.5,y:1}])=>({...p,hanging:{basis:hangingBasis(p),confirmed:true,points:points.map((q,i)=>({id:'point-'+i,kind:'direct',rise:0,...q}))}});
const project=p=>({format:'wallstory',version:1,state:{wall:{w:120,h:96},unit:'in',gap:2,margin:4,center:57,style:'balanced',items:[p],photo:null,rawPhoto:null,corners:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]}});
const input=(h,id,value)=>{h.node(id).value=value;h.event(id,'input')};
const confirm=h=>{h.node('hanging-confirmed').checked=true;h.event('hanging-confirmed','change')};
const openStudio=h=>{h.node('studio-enter').click();h.doc.querySelector('[data-studio-piece]').click();h.node('studio-hangers').click()};

test('the 9-inch centered hanger and 10-inch two-hanger examples locate actual nails',()=>{
 const one=measured(frame({w:9}),[{x:4.5,y:.5}]);const n=wallFasteners(one,{w:120,h:96})[0];close(n.x,24.5);close(n.y,12.5);
 const two=wallFasteners(measured(frame()),{w:120,h:96});assert.deepEqual(two.map(q=>[q.x,q.y,q.right]),[[27.5,13,92.5],[22.5,13,97.5]]);
});
test('asymmetric back measurements mirror once, including frames already rotated',()=>{
 for(const rotation of [0,90,180,270]){const p=measured(frame({rotation}),[{x:2,y:.5}]),q=p.hanging.points[0];assert.deepEqual(viewPoint(p,q,true),{x:2,y:.5});assert.deepEqual(viewPoint(p,q,false),{x:8,y:.5});close(wallFasteners(p,{w:120,h:96})[0].x,28)}
});
test('a hook puts its nail above the support, and out-of-wall coordinates are flagged',()=>{
 const p=measured(frame({y:.25}),[{x:2,y:.5,kind:'hook',rise:1}]);const q=wallFasteners(p,{w:120,h:96})[0];close(q.supportY,.75);close(q.y,-.25);assert.equal(q.outside,true);assert.match(buildHangingGuide(project(p).state),/OUTSIDE WALL/);
});
test('unmeasured, resized, rotated and copied frames never receive guessed nail coordinates',()=>{
 const p=measured(frame());assert.equal(hangingStatus(frame()).label,'Hanging points not measured');
 for(const next of [{...p,w:11},{...p,rotation:90},{...p,shape:'oval'}]){const q=reconcileHanging(p,next);assert.equal(q.hanging.confirmed,false);assert.deepEqual(wallFasteners(q,{w:120,h:96}),[]);assert.equal(hangingStatus(next).ready,false)}
 const copy=reconcileHanging(null,{...p,id:'copy'});assert.equal(copy.hanging.confirmed,false);copy.hanging.points[0].x=4;close(p.hanging.points[0].x,2.5);
 const moved=reconcileHanging(p,{...p,x:30});assert.equal(hangingStatus(moved).ready,true);close(wallFasteners(moved,{w:120,h:96})[0].x,37.5);
});
test('old project files gain an explicit unmeasured state; invalid and oversized hanger data is rejected',()=>{
 const old=validateProject(project(frame()));assert.equal(old.items[0].hanging,null);
 const p=measured(frame());assert.deepEqual(validateProject(project(p)).items[0].hanging,p.hanging);
 for(const bad of [NaN,Infinity,-1,601]){const h=cloneHanging(p.hanging);h.points[0].x=bad;assert.throws(()=>validateHanging(h))}
 for(const mutate of [h=>h.points[0].x=11,h=>h.points[1].id=h.points[0].id,h=>h.points[0].id='bad"<id',h=>h.points[0].rise=1,h=>h.confirmed='yes',h=>h.points=Array(13).fill(h.points[0])]){const h=cloneHanging(p.hanging);mutate(h);assert.throws(()=>validateHanging(h))}
});
test('guide separates frame edges and nails, provides right-wall distances and excludes draft marks',()=>{
 const p=measured(frame({name:'<script>bad</script>'})),s=project(p).state,html=buildHangingGuide(s,false);
 assert.match(html,/Right edge/);assert.match(html,/From wall right/);assert.match(html,/27.5 in/);assert.match(html,/92.5 in/);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('data-guide-hanging'));
 const map=hangingMap(s,true);assert.match(map,/>1A</);p.hanging.confirmed=false;assert.ok(!hangingMap(s,true).includes('>1A<'));assert.match(buildHangingGuide(s),/nail coordinates withheld/);
});
test('back editor saves exact inputs, front mirroring, hooks, photos and multiple points across restore',async()=>{
 const h=await appHarness(project(frame({image:'data:image/png;base64,YWJj'})));let saved;try{
 openStudio(h);assert.equal(h.node('hanging-dialog').open,true);h.node('hanging-pair').click();
 input(h,'hanging-x','2');input(h,'hanging-y','.5');h.node('hanging-front').click();close(Number(h.node('hanging-x').value),8);close(Number(h.node('hanging-right').value),2);
 input(h,'hanging-right','3');close(Number(h.node('hanging-x').value),7);h.node('hanging-back').click();close(Number(h.node('hanging-x').value),3);
 h.node('hanging-kind').value='hook';h.event('hanging-kind','change');input(h,'hanging-rise','.25');confirm(h);h.event('hanging-form','submit');await h.settle();
 assert.equal(h.node('hanging-dialog').open,false);const p=h.state.items[0];close(p.hanging.points[0].x,3);close(p.hanging.points[0].rise,.25);assert.equal(p.hanging.points.length,2);assert.equal(hangingStatus(p).ready,true);
 close(wallFasteners(p,h.state.wall)[0].x,27);close(wallFasteners(p,h.state.wall)[0].y,12.25);assert.equal(p.image,'data:image/png;base64,YWJj');saved=h.savedProjects.at(-1);
 }finally{h.dispose()}
 const restored=await appHarness(saved);try{assert.equal(hangingStatus(restored.state.items[0]).ready,true);close(restored.state.items[0].hanging.points[0].x,3)}finally{restored.dispose()}
});
test('drag and keyboard edits use true frame units in both views and stay within the frame',async()=>{
 const h=await appHarness(project(measured(frame())));try{
 openStudio(h);h.node('hanging-front').click();const el=h.doc.querySelector('[data-hanging-marker]'),rect=h.node('hanging-board').getBoundingClientRect();
 el.dispatchEvent({type:'pointerdown',button:0,isPrimary:true,pointerId:2,clientX:100,clientY:100});el.dispatchEvent({type:'pointermove',pointerId:2,clientX:100+rect.width/10,clientY:100+rect.height/12});el.dispatchEvent({type:'pointerup',pointerId:2});
 close(Number(h.node('hanging-x').value),8.5);close(Number(h.node('hanging-y').value),2);el.dispatchEvent({type:'keydown',key:'ArrowLeft'});close(Number(h.node('hanging-x').value),8.4375);
 h.node('hanging-back').click();close(Number(h.node('hanging-x').value),1.5625);assert.equal(h.node('hanging-confirmed').checked,false);
 }finally{h.dispose()}
});
test('unfinished and invalid hanging edits block reload and cannot silently overwrite saved measurements',async()=>{
 const h=await appHarness(project(measured(frame())));try{
 openStudio(h);input(h,'hanging-x','');h.event('hanging-form','submit');assert.equal(h.node('hanging-dialog').open,true);close(h.state.items[0].hanging.points[0].x,2.5);
 await assert.rejects(h.window.wallstoryProject.prepareForUpdate(),/Finish/);
 input(h,'hanging-x','3');h.node('hanging-close').click();assert.equal(h.node('confirm-dialog').open,true);h.node('confirm-yes').click();assert.equal(h.node('hanging-dialog').open,false);close(h.state.items[0].hanging.points[0].x,2.5);
 }finally{h.dispose()}
});
test('hanging changes have isolated undo snapshots and resize requires reconfirmation',async()=>{
 const h=await appHarness(project(measured(frame())));try{
 openStudio(h);input(h,'hanging-x','3');confirm(h);h.event('hanging-form','submit');await h.settle();
 h.node('studio-undo').click();close(h.state.items[0].hanging.points[0].x,2.5);h.node('studio-redo').click();close(h.state.items[0].hanging.points[0].x,3);
 h.doc.querySelector('[data-studio-piece]').click();input(h,'studio-width','11');h.event('studio-piece-form','submit');assert.equal(hangingStatus(h.state.items[0]).ready,false);close(h.state.items[0].hanging.points[0].x,3);
 h.node('studio-undo').click();assert.equal(hangingStatus(h.state.items[0]).ready,true);
 }finally{h.dispose()}
});
test('main piece editor preserves hanging data and untouched precision, and launches from its save button',async()=>{
 const original=measured(frame({w:10.123456,h:12.123456,x:20.123456})),h=await appHarness(project(original));try{
 h.doc.querySelector('[data-edit]').click();input(h,'piece-name','Renamed');h.event('piece-form','submit',{submitter:h.node('piece-hangers')});
 assert.equal(h.node('hanging-dialog').open,true);assert.equal(h.state.items[0].name,'Renamed');close(h.state.items[0].w,original.w);close(h.state.items[0].h,original.h);close(h.state.items[0].x,original.x);assert.equal(hangingStatus(h.state.items[0]).ready,true);
 }finally{h.dispose()}
});
test('centimeters, symmetric pair and equal height helpers retain precise physical offsets',async()=>{
 const data=project(frame());data.state.unit='cm';const h=await appHarness(data);try{
 openStudio(h);h.node('hanging-pair').click();input(h,'hanging-x','6.35');input(h,'hanging-y','2.54');h.node('hanging-level').click();confirm(h);h.event('hanging-form','submit');
 close(h.state.items[0].hanging.points[0].x,2.5);for(const p of h.state.items[0].hanging.points)close(p.y,1);assert.match(buildHangingGuide(h.state),/69.85 cm/);
 }finally{h.dispose()}
});
test('studio preserves untouched decimal dimensions and correctly converts nearly equal rectangles to squares',async()=>{
 const original=measured(frame({w:10.12345,h:10.12349})),h=await appHarness(project(original));try{
 h.node('studio-enter').click();h.doc.querySelector('[data-studio-piece]').click();input(h,'studio-name','Keep precision');h.event('studio-piece-form','submit');close(h.state.items[0].h,original.h);assert.equal(hangingStatus(h.state.items[0]).ready,true);
 h.node('studio-shape').value='square';h.event('studio-shape','change');h.event('studio-piece-form','submit');close(h.state.items[0].w,h.state.items[0].h);assert.equal(hangingStatus(h.state.items[0]).ready,false);
 }finally{h.dispose()}
});
test('corner resize invalidates measured hardware and one Undo restores the original measurements',async()=>{
 const h=await appHarness(project(measured(frame())));try{
 h.node('studio-enter').click();h.doc.querySelector('[data-studio-piece]').click();const el=h.doc.querySelector('[data-resize="se"]');
 el.dispatchEvent({type:'pointerdown',button:0,pointerId:7,clientX:100,clientY:100});el.dispatchEvent({type:'pointermove',pointerId:7,clientX:130,clientY:120});el.dispatchEvent({type:'pointerup',pointerId:7});await h.settle();assert.equal(hangingStatus(h.state.items[0]).ready,false);assert.equal(h.savedProjects.at(-1).state.items[0].hanging.confirmed,false);
 h.node('studio-undo').click();assert.equal(hangingStatus(h.state.items[0]).ready,true);close(h.state.items[0].w,10);close(h.state.items[0].hanging.points[0].x,2.5);
 }finally{h.dispose()}
});
