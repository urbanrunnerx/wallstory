import {cloneHanging,hangingBasis,hangingStatus,viewPoint} from './hanging.js';
export function createHangingEditor(api){
  const $=id=>document.getElementById(id),root=$('hanging-dialog'),board=$('hanging-board');
  let piece=null,draft=null,activeId=null,back=true,dirty=false,gesture=null,returnFocus=null;
  const invalid=new Set();
  const factor=()=>api.unit()==='cm'?2.54:1;
  const show=n=>Number((n*factor()).toFixed(4));
  const measured=n=>`${Number((n*factor()).toFixed(4))} ${api.unit()}`;
  const point=()=>draft?.points.find(q=>q.id===activeId);
  const label=q=>String.fromCharCode(65+draft.points.indexOf(q));
  const error=message=>$('hanging-error').textContent=message;
  function canAct(){if(invalid.size){error('Finish the highlighted measurement before continuing.');return false}return true}
  function edited(){dirty=true;draft.confirmed=false;$('hanging-confirmed').checked=false;error('');review()}
  function review(){
    const outside=draft.points.some(q=>q.x>piece.w||q.y>piece.h);
    $('hanging-review').textContent=outside?'A saved point is outside the new frame size. Move it inside before confirming.':draft.confirmed?'Measurements confirmed. The hanging guide can calculate nail positions.':'Not confirmed yet. Check the actual hardware before using nail positions.';
    $('hanging-confirmed').disabled=!draft.points.length||outside;
  }
  function fit(){
    if(!root.open)return;
    const r=$('hanging-stage').getBoundingClientRect(),scale=Math.min(Math.max(1,r.width-64)/piece.w,Math.max(1,r.height-64)/piece.h);
    board.style.width=`${piece.w*scale}px`;board.style.height=`${piece.h*scale}px`;
  }
  function outline(){
    const odd=piece.rotation%180!==0,w=odd?piece.h:piece.w,h=odd?piece.w:piece.h;
    $('hanging-outline').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${piece.w} ${piece.h}" aria-hidden="true"><g transform="${back?`translate(${piece.w} 0) scale(-1 1) `:''}translate(${piece.w/2} ${piece.h/2}) rotate(${piece.rotation}) translate(${-w/2} ${-h/2})">${api.shape({...piece,w,h},`fill="${back?'#dfd1ba':'#f3eee3'}" stroke="${piece.color}" stroke-width="${Math.min(w,h)*.035}"` )}</g></svg>`;
  }
  function renderFields(){
    const q=point();$('hanging-point-fields').disabled=!q;
    $('hanging-point-title').textContent=q?`Point ${label(q)}`:'Add a hanging point';
    for(const id of ['x','right','y','rise'])$(`hanging-${id}`).value=q?show(id==='right'?piece.w-viewPoint(piece,q,back).x:id==='x'?viewPoint(piece,q,back).x:q[id]):'';
    $('hanging-kind').value=q?.kind||'direct';hardware();
    for(const id of ['x','right'])$(`hanging-${id}`).max=show(piece.w);
    $('hanging-y').max=show(piece.h);$('hanging-rise').max=show(24);
  }
  function hardware(){
    const hook=point()?.kind==='hook';$('hanging-rise-field').hidden=!hook;
    $('hanging-hardware-note').textContent=hook?'The crosshair is the frame support point. The nail goes above it by your measured hook offset.':'Place the crosshair at the actual nail or screw contact point, including wire tension if used.';
  }
  function draw(){
    const q=point();
    for(const p of draft.points){
      const pos=viewPoint(piece,p,back),marker=root.querySelector(`[data-hanging-marker="${p.id}"]`),button=root.querySelector(`[data-hanging-select="${p.id}"]`);
      if(marker){marker.style.left=`${Math.max(0,Math.min(piece.w,pos.x))/piece.w*100}%`;marker.style.top=`${Math.max(0,Math.min(piece.h,p.y))/piece.h*100}%`;marker.classList.toggle('active',p===q);marker.classList.toggle('outside',p.x>piece.w||p.y>piece.h);marker.setAttribute('aria-label',`Point ${label(p)}. ${measured(pos.x)} from ${back?'back':'front'} left, ${measured(p.y)} from top. Drag or use arrow keys.`)}
      if(button)button.setAttribute('aria-pressed',String(p===q));
    }
    if(q){
      const pos=viewPoint(piece,q,back),x=Math.max(0,Math.min(100,pos.x/piece.w*100)),y=Math.max(0,Math.min(100,q.y/piece.h*100));
      $('hanging-rulers').innerHTML=`<span class="hanging-rule horizontal" style="top:${y}%;width:${x}%"></span><span class="hanging-rule vertical" style="left:${x}%;height:${y}%"></span>`;
      $('hanging-live').textContent=`${label(q)} · Left ${measured(pos.x)} · Right ${measured(piece.w-pos.x)} · Top ${measured(q.y)} (${back?'back':'front'} view)`;
    }else{$('hanging-rulers').innerHTML='';$('hanging-live').textContent='No hanging points yet. Choose a shortcut or add a point.'}
    review();
  }
  function rebuild(){
    $('hanging-markers').innerHTML=draft.points.map(q=>`<button type="button" class="hanging-marker" data-hanging-marker="${q.id}"><span class="hanging-crosshair" aria-hidden="true"></span><span class="hanging-letter" aria-hidden="true">${label(q)}</span></button>`).join('');
    $('hanging-point-list').innerHTML=draft.points.map(q=>`<button type="button" data-hanging-select="${q.id}" aria-pressed="${q.id===activeId}">Point ${label(q)}</button>`).join('');
    $('hanging-add').disabled=draft.points.length>=12;renderFields();draw();
  }
  function side(next){if(!canAct())return;back=next;$('hanging-back').setAttribute('aria-pressed',String(back));$('hanging-front').setAttribute('aria-pressed',String(!back));$('hanging-left-label').textContent=`From ${back?'back':'front'} left`;$('hanging-right-label').textContent=`From ${back?'back':'front'} right`;$('hanging-side-note').textContent=back?'↑ FRAME TOP · Looking at the back. Left and right mirror when hung.':'↑ FRAME TOP · Facing the wall. Points are shown through the frame.';outline();renderFields();draw()}
  function select(id){if(!canAct())return false;activeId=id;renderFields();draw();return true}
  function open(id){
    piece=api.piece(id);if(!piece)return;
    piece={...piece};draft=cloneHanging(piece.hanging)||{basis:hangingBasis(piece),points:[],confirmed:false};
    if(!hangingStatus(piece).ready)draft.confirmed=false;
    activeId=draft.points[0]?.id||null;dirty=false;gesture=null;invalid.clear();returnFocus=document.activeElement;
    for(const id of ['x','right','y','rise'])$(`hanging-${id}`).removeAttribute('aria-invalid');
    $('hanging-piece-name').textContent=`${piece.name} · ${measured(piece.w)} × ${measured(piece.h)}`;
    root.querySelectorAll('.hanging-unit').forEach(n=>n.textContent=api.unit());
    $('hanging-confirmed').checked=draft.confirmed;error('');rebuild();side(true);root.showModal();fit();$('hanging-back').focus();
  }
  function close(){root.close();gesture=null;dirty=false;returnFocus?.focus({preventScroll:true})}
  function requestClose(){if(dirty)api.confirm('Discard hanging edits?','Your saved hanging measurements will stay as they were.',close);else close()}
  $('hanging-close').addEventListener('click',requestClose);root.addEventListener('cancel',e=>{e.preventDefault();requestClose()});
  $('hanging-back').addEventListener('click',()=>side(true));$('hanging-front').addEventListener('click',()=>side(false));
  $('hanging-point-list').addEventListener('click',e=>{const b=e.target.closest('[data-hanging-select]');if(b)select(b.dataset.hangingSelect)});
  const newPoint=(x,y)=>({id:crypto.randomUUID(),x,y,kind:'direct',rise:0});
  function shortcut(pair){
    if(!canAct())return;
    const apply=()=>{const y=Math.min(piece.h/4,pair?1:.5);draft.points=pair?[newPoint(piece.w/4,y),newPoint(piece.w*3/4,y)]:[newPoint(piece.w/2,y)];activeId=draft.points[0].id;edited();rebuild()};
    if(draft.points.length)api.confirm('Replace hanging points?',`Start with ${pair?'two symmetric points':'one centered point'}? Measure the actual offsets afterward.`,apply);else apply();
  }
  $('hanging-single').addEventListener('click',()=>shortcut(false));$('hanging-pair').addEventListener('click',()=>shortcut(true));
  $('hanging-add').addEventListener('click',()=>{if(!canAct()||draft.points.length>=12)return;const q=newPoint(piece.w/2,Math.min(piece.h/4,1+draft.points.length*.5));draft.points.push(q);activeId=q.id;edited();rebuild()});
  $('hanging-remove').addEventListener('click',()=>{if(!canAct()||!point())return;draft.points=draft.points.filter(q=>q.id!==activeId);activeId=draft.points[0]?.id||null;edited();rebuild()});
  $('hanging-center').addEventListener('click',()=>{if(!canAct()||!point())return;point().x=piece.w/2;edited();renderFields();draw()});
  $('hanging-level').addEventListener('click',()=>{if(!canAct()||!point())return;const y=point().y;draft.points.forEach(q=>q.y=y);edited();renderFields();draw()});
  for(const id of ['x','right','y','rise'])$(`hanging-${id}`).addEventListener('input',()=>{
    const q=point();if(!q)return;const el=$(`hanging-${id}`),n=Number(el.value)/factor(),max=id==='y'?piece.h:id==='rise'?24:piece.w;
    edited();
    if(!el.value.trim()||!Number.isFinite(n)||n<0||n>max+1e-7){invalid.add(id);el.setAttribute('aria-invalid','true');error(`Enter a measurement from 0 to ${measured(max)}.`);return}
    invalid.delete(id);el.removeAttribute('aria-invalid');const value=Math.max(0,Math.min(max,n));
    if(id==='x'||id==='right'){
      const displayX=id==='right'?piece.w-value:value;q.x=back?displayX:piece.w-displayX;
      const other=id==='x'?'right':'x';$(`hanging-${other}`).value=show(piece.w-value);
      invalid.delete(other);$(`hanging-${other}`).removeAttribute('aria-invalid');
    }else q[id]=value;
    draw();
  });
  $('hanging-kind').addEventListener('change',()=>{if(!point())return;point().kind=$('hanging-kind').value;point().rise=0;$('hanging-rise').value=0;invalid.delete('rise');$('hanging-rise').removeAttribute('aria-invalid');edited();hardware();draw()});
  $('hanging-confirmed').addEventListener('change',()=>{draft.confirmed=$('hanging-confirmed').checked;dirty=true;review()});
  $('hanging-form').addEventListener('submit',e=>{
    e.preventDefault();if(!canAct()||gesture)return;
    try{draft.confirmed=$('hanging-confirmed').checked;if(draft.confirmed&&(!draft.points.length||draft.points.some(q=>q.x>piece.w||q.y>piece.h)))throw Error('Place each support point within the frame before confirming.');api.save(piece.id,{...draft,basis:hangingBasis(piece)});close();api.toast(draft.confirmed?'Hanging measurements saved. Open Hanging guide for nail positions.':'Hanging draft saved. Confirm your measurements to show nail positions.')}catch(e){error(e.message)}
  });
  $('hanging-markers').addEventListener('pointerdown',e=>{
    const el=e.target.closest('[data-hanging-marker]');if(!el||e.button!==0||e.isPrimary===false||gesture||!select(el.dataset.hangingMarker))return;
    const q=point();gesture={el,id:e.pointerId,startX:e.clientX,startY:e.clientY,x:q.x,y:q.y,rect:board.getBoundingClientRect()};el.setPointerCapture(e.pointerId);el.focus({preventScroll:true});e.preventDefault();
  });
  $('hanging-markers').addEventListener('pointermove',e=>{
    const g=gesture;if(!g||g.id!==e.pointerId)return;
    const q=point(),dx=(e.clientX-g.startX)/g.rect.width*piece.w,dy=(e.clientY-g.startY)/g.rect.height*piece.h;
    q.x=Math.max(0,Math.min(piece.w,g.x+(back?dx:-dx)));q.y=Math.max(0,Math.min(piece.h,g.y+dy));edited();renderFields();draw();e.preventDefault();
  });
  const end=e=>{if(gesture?.id!==e.pointerId)return;const g=gesture;gesture=null;if(g.el.hasPointerCapture(e.pointerId))g.el.releasePointerCapture(e.pointerId)};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])$('hanging-markers').addEventListener(type,end);
  $('hanging-markers').addEventListener('keydown',e=>{
    const el=e.target.closest('[data-hanging-marker]'),moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!el||!moves[e.key]||!select(el.dataset.hangingMarker))return;
    e.preventDefault();const q=point(),[x,y]=moves[e.key],step=(api.unit()==='cm'?.1/2.54:1/16)*(e.shiftKey?4:1);
    q.x=Math.max(0,Math.min(piece.w,q.x+x*step*(back?1:-1)));q.y=Math.max(0,Math.min(piece.h,q.y+y*step));edited();renderFields();draw();
  });
  $('hanging-markers').addEventListener('click',e=>{const b=e.target.closest('[data-hanging-marker]');if(b)select(b.dataset.hangingMarker)});
  new ResizeObserver(fit).observe($('hanging-stage'));window.addEventListener('resize',fit);
  return {open,hasDraft:()=>root.open&&dirty};
}
