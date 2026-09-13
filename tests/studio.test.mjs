import test from 'node:test';
import assert from 'node:assert/strict';
import {fitWall,zoomAt,resizePiece,resizeFromCenter} from '../studio-math.js';
import {appHarness} from './studio-harness.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('wall fits landscape and portrait without distorting a 30 by 9 foot rectangle',()=>{
 for(const [w,h] of [[932,290],[390,350],[1280,700],[270,160]]){const r=fitWall(w,h,360,108,26);close(r.width/r.height,360/108);assert.ok(r.width<=w&&r.height<=h)}
});
test('pinch zoom preserves the point under the fingers and never changes wall units',()=>{
 const old={zoom:2,x:40,y:-20},point={x:150,y:75};const result=zoomAt(old,5,point);
 close((point.x-old.x)/old.zoom,(point.x-result.x)/result.zoom);close((point.y-old.y)/old.zoom,(point.y-result.y)/result.zoom);
 assert.equal(zoomAt(old,99,point).zoom,8);assert.equal(zoomAt(old,0,point).zoom,1);
});
test('each resize corner preserves its opposite corner and obeys measurement limits',()=>{
 const p={x:40,y:30,w:20,h:16,shape:'rectangle'},wall={w:144,h:96};
 for(const corner of ['nw','ne','sw','se']){const next=resizePiece(p,corner,3,2,wall);close(corner.includes('w')?next.x+next.w:next.x,corner.includes('w')?p.x+p.w:p.x);close(corner.includes('n')?next.y+next.h:next.y,corner.includes('n')?p.y+p.h:p.y);assert.ok(next.w>=.25&&next.h>=.25)}
 for(const shape of ['circle','square'])for(const dx of [-100,3,400]){const next=resizePiece({...p,w:16,shape},'se',dx,7,wall);close(next.w,next.h);assert.ok(next.w>=.25&&next.x+next.w<=wall.w)}
 const ratio=resizePiece(p,'se',8,1,wall,true);close(ratio.w/ratio.h,p.w/p.h);
});
test('exact size edits preserve piece center where the wall has room',()=>{
 const next=resizeFromCenter({x:30,y:20,w:20,h:10},30,18,{w:144,h:96});close(next.x+next.w/2,40);close(next.y+next.h/2,25);
});
test('studio enters, adds and sizes a real piece, saves it, and returns the same wall node',async()=>{
 const h=await appHarness();try{
 const original=h.node('wall'),parent=original.parentNode;const count=h.state.items.length;
 h.node('studio-enter').click();assert.equal(h.node('wall-studio').hidden,false);assert.equal(original.parentNode.id,'studio-world');assert.equal(h.node('planner').inert,true);
 h.node('studio-add').click();assert.equal(h.node('studio-piece-form').hidden,false);
 for(const [id,value] of [['studio-name','Landscape keepsake'],['studio-width','24'],['studio-height','18']]){h.node(id).value=value;h.event(id,'input')}
 h.event('studio-piece-form','submit');await h.settle();
 assert.equal(h.state.items.length,count+1);const p=h.state.items.at(-1);assert.equal(p.name,'Landscape keepsake');assert.equal(p.w,24);assert.equal(p.h,18);
 h.node('studio-width').value='30';h.event('studio-width','input');h.event('studio-piece-form','submit');await h.settle();assert.equal(h.state.items.at(-1).w,30);
 assert.equal(h.savedProjects.at(-1).state.items.at(-1).w,30);
 h.node('studio-exit').click();assert.equal(h.node('wall-studio').hidden,true);assert.equal(original.parentNode,parent);assert.equal(h.node('planner').inert,false);
 }finally{h.dispose()}
});
test('full-screen rotate, duplicate, and undo use the shared project history',async()=>{
 const h=await appHarness();try{
 h.node('studio-enter').click();const p=h.state.items[0];
 const row=h.doc.querySelector(`[data-studio-piece="${p.id}"]`);row.click();
 h.node('studio-rotate').click();assert.equal(h.state.items[0].w,p.h);assert.equal(h.state.items[0].rotation,90);
 const count=h.state.items.length;h.node('studio-duplicate').click();assert.equal(h.state.items.length,count+1);
 h.node('studio-undo').click();assert.equal(h.state.items.length,count);
 h.node('studio-undo').click();assert.equal(h.state.items[0].rotation,0);
 }finally{h.dispose()}
});
test('unapplied studio form edits stop updates from reloading the design',async()=>{
 const h=await appHarness();try{h.node('studio-enter').click();h.node('studio-add').click();h.node('studio-name').value='Unfinished';h.event('studio-name','input');await assert.rejects(h.window.wallstoryProject.prepareForUpdate(),/Finish your current edit/)}finally{h.dispose()}
});
test('corner resizing commits one undo step and retains the result in autosave',async()=>{
 const h=await appHarness();try{
 h.node('studio-enter').click();const before={...h.state.items[0]};h.doc.querySelector(`[data-studio-piece="${before.id}"]`).click();
 const handle=h.doc.querySelector('[data-resize="se"]');
 handle.dispatchEvent({type:'pointerdown',button:0,pointerId:4,clientX:200,clientY:200});
 handle.dispatchEvent({type:'pointermove',pointerId:4,clientX:240,clientY:220});
 assert.ok(h.state.items[0].w>before.w);await assert.rejects(h.window.wallstoryProject.prepareForUpdate(),/Finish/);
 handle.dispatchEvent({type:'pointerup',pointerId:4,clientX:240,clientY:220});await h.settle();
 close(h.savedProjects.at(-1).state.items[0].w,h.state.items[0].w);
 h.node('studio-undo').click();close(h.state.items[0].w,before.w);close(h.state.items[0].h,before.h);
 }finally{h.dispose()}
});
test('dragging after zoom uses wall dimensions and saves the actual moved coordinates',async()=>{
 const h=await appHarness();try{
 h.node('studio-enter').click();h.node('studio-zoom-in').click();const before={...h.state.items[0]},rect=h.node('wall').getBoundingClientRect();
 const piece=h.doc.querySelector(`[data-piece="${before.id}"]`);
 piece.dispatchEvent({type:'pointerdown',button:0,isPrimary:true,pointerId:1,clientX:100,clientY:100});
 piece.dispatchEvent({type:'pointermove',pointerId:1,clientX:130,clientY:110});
 piece.dispatchEvent({type:'pointerup',pointerId:1,clientX:130,clientY:110});await h.settle();
 const p=h.state.items[0];close(p.x,Math.round((before.x+30/rect.width*h.state.wall.w)*4)/4);close(p.w,before.w);close(p.h,before.h);
 close(h.savedProjects.at(-1).state.items[0].x,p.x);
 }finally{h.dispose()}
});
test('a two-pointer pinch zooms the view without moving the selected piece',async()=>{
 const h=await appHarness();try{
 h.node('studio-enter').click();const before=JSON.stringify(h.state.items),piece=h.doc.querySelector('[data-piece]'),viewport=h.node('studio-viewport');
 piece.dispatchEvent({type:'pointerdown',button:0,isPrimary:true,pointerId:1,clientX:200,clientY:200});
 viewport.dispatchEvent({type:'pointerdown',button:0,isPrimary:false,pointerId:2,clientX:300,clientY:200});
 viewport.dispatchEvent({type:'pointermove',pointerId:2,clientX:400,clientY:200});
 viewport.dispatchEvent({type:'pointerup',pointerId:2});viewport.dispatchEvent({type:'pointerup',pointerId:1});
 assert.equal(JSON.stringify(h.state.items),before);assert.equal(h.node('studio-zoom').textContent,'200%');
 }finally{h.dispose()}
});
test('centimeter sizing and square constraints survive restoring a project',async()=>{
 const h=await appHarness();let saved;try{
 h.node('units').value='cm';h.event('units','change');h.node('studio-enter').click();h.node('studio-add').click();h.node('studio-name').value='Square print';h.node('studio-shape').value='square';h.event('studio-shape','change');h.node('studio-width').value='25.4';h.event('studio-width','input');h.event('studio-piece-form','submit');await h.settle();
 const p=h.state.items.at(-1);close(p.w,10);close(p.h,10);saved=h.savedProjects.at(-1);
 }finally{h.dispose()}
 const restored=await appHarness(saved);try{assert.equal(restored.state.unit,'cm');close(restored.state.items.at(-1).w,10);assert.equal(restored.state.items.at(-1).name,'Square print')}finally{restored.dispose()}
});
