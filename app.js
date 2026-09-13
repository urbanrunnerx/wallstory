import {arrange,bounds,issues,clamp,validCorners,homography,validateProject} from './layout.js';
import {createDraftStore,createAutosaver} from './project-store.js';
import {createStudio} from './studio.js';
import {cloneHanging,hangingStatus,reconcileHanging} from './hanging.js';
import {createHangingEditor} from './hanging-editor.js';
import {svgShape,hangingMap,buildHangingGuide} from './hanging-guide.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const defaultCorners=()=>[{x:.05,y:.05},{x:.95,y:.05},{x:.95,y:.85},{x:.05,y:.85}];
const starter=[['The big picture',20,28,'rectangle','#453c32'],['A favorite memory',12,16,'rectangle','#ba9163'],['A little perspective',16,12,'rectangle','#242927'],['Round mirror',14,14,'circle','#a88b48'],['Something small',10,10,'square','#453c32'],['Weekend find',10,14,'arch','#ba9163'],['A keepsake',8,10,'rectangle','#e9e5db']];
let state={wall:{w:144,h:96},unit:'in',gap:2,margin:4,center:57,style:'balanced',items:starter.map((a,i)=>({id:'piece-'+(i+1),name:a[0],w:a[1],h:a[2],shape:a[3],color:a[4],image:null,x:0,y:0,rotation:0})),photo:null,rawPhoto:null,corners:defaultCorners()};
const initial=arrange(state);if(initial.ok)state.items=initial.items;
let selected=null,tab='wall',planView=false,showMeasurements=true,showGrid=false,snap=true,history=[],future=[],dirty=false,variation=0,editing=null,draftImage=null,draftRotation=0,pieceFields={},pendingPhoto=null,calibrationMode='wall',calibrationCorners=defaultCorners(),calibrationDrag=null,drag=null,toastTimer;
let autosaver=null,initializing=true,pendingOperations=0,studio=null,hangingEditor=null;
const unitFactor=()=>state.unit==='cm'?2.54:1;
const number=(v,digits=2)=>Number(v.toFixed(digits)).toLocaleString('en-US',{maximumFractionDigits:digits});
const display=v=>Number((v*unitFactor()).toFixed(2));
const measure=v=>`${number(v*unitFactor())} ${state.unit}`;
const toIn=v=>Number(v)/unitFactor();
function snapshot(){return {...state,wall:{...state.wall},items:state.items.map(p=>({...p,hanging:cloneHanging(p.hanging)})),corners:state.corners.map(p=>({...p}))}}
function projectDraft(){return {format:'wallstory',version:1,state:snapshot(),view:{tab,planView,showMeasurements,showGrid,snap}}}
function autosaveStatus(status,error){
  $('#save-strip').dataset.saveState=status;
  $('#autosave-status').textContent=status==='saving'?'Saving on this device…':status==='saved'?'Saved on this device.':error?.name==='DraftConflictError'?error.message:'Autosave is unavailable. Use Save project to keep a backup.';
}
function saveDraft(){if(!initializing&&autosaver)autosaver.queue(projectDraft())}
function changed(){dirty=true;saveDraft()}
function remember(){history.push(snapshot());if(history.length>30)history.shift();future=[]}
function commit(action){remember();action();changed();render()}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,5000)}
function setTab(next,scroll=false){tab=next;$$('[data-tab]').forEach(b=>{b.setAttribute('aria-selected',b.dataset.tab===tab);b.tabIndex=b.dataset.tab===tab?0:-1});$$('[role=tabpanel]').forEach(p=>p.hidden=p.id!==`panel-${tab}`);if(scroll&&innerWidth<761)$('#panel-'+tab).scrollIntoView({behavior:'smooth',block:'start'});saveDraft()}
function setInput(id,value,min,max){const el=$(id);el.value=display(value);if(min!==undefined)el.min=display(min);if(max!==undefined)el.max=display(max)}
function shapeClip(shape){return shape==='hexagon'?'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)':'none'}
function bodyStyle(p){const odd=p.rotation%180!==0;return `left:50%;top:50%;width:${odd?p.h/p.w*100:100}%;height:${odd?p.w/p.h*100:100}%;transform:translate(-50%,-50%) rotate(${p.rotation}deg)`}
function pieceMarkup(p,i){return `<button class="piece ${p.shape}${p.image?' has-photo':''}${selected===p.id?' selected':''}" data-piece="${esc(p.id)}" aria-label="${esc(p.name)}, ${measure(p.w)} by ${measure(p.h)}. Drag or use arrow keys to move; Enter to edit." style="left:${p.x/state.wall.w*100}%;top:${p.y/state.wall.h*100}%;width:${p.w/state.wall.w*100}%;height:${p.h/state.wall.h*100}%;--frame:${p.color};--clip:${shapeClip(p.shape)}"><span class="piece-body" style="${bodyStyle(p)}"><span class="piece-shape"><span class="piece-mat">${p.image?`<img src="${p.image}" alt="" draggable="false">`:`<span class="piece-number">${String(i+1).padStart(2,'0')}</span>`}</span></span></span><span class="piece-label"${showMeasurements?'':' hidden'}>${number(display(p.w))} × ${number(display(p.h))}</span></button>`}
function render(){
  $('#units').value=state.unit;$$('.unit-label').forEach(e=>e.textContent=state.unit);
  setInput('#wall-width',state.wall.w,12,1200);setInput('#wall-height',state.wall.h,12,1200);setInput('#gap',state.gap,0,24);setInput('#center-height',state.center,0,state.wall.h);setInput('#margin',state.margin,0,Math.min(state.wall.w,state.wall.h)/2);
  $('#snap-label').textContent=state.unit==='cm'?'½ centimeter':'¼ inch';
  $('#wall').style.aspectRatio=`${state.wall.w}/${state.wall.h}`;$('#wall').classList.toggle('plan',planView);
  $('#wall').style.backgroundImage=state.photo?`url("${state.photo}")`:'url("./sample-wall.webp")';$('#wall').style.backgroundSize=state.photo?'100% 100%':'100% 120.5%';
  $('#width-label').textContent=measure(state.wall.w);$('#height-label').textContent=measure(state.wall.h);$('#pieces-layer').innerHTML=state.items.map(pieceMarkup).join('');
  $('#wall-empty').hidden=!!state.items.length;$('#photo-actions').hidden=!state.photo;
  $('#room-label').textContent=state.photo?'YOUR WALL · CALIBRATED PREVIEW':'SAMPLE WALL · TRY YOUR OWN PHOTO';
  $('#wall-grid').hidden=!showGrid;const gridSize=state.unit==='in'?6:10/2.54;$('#wall-grid').style.backgroundSize=`${gridSize/state.wall.w*100}% ${gridSize/state.wall.h*100}%`;
  $('#piece-count').textContent=String(state.items.length).padStart(2,'0');
  $('#piece-list').innerHTML=state.items.length?state.items.map((p,i)=>`<button class="piece-row" data-edit="${esc(p.id)}"><span class="piece-mini ${p.shape}" style="--frame:${p.color}">${p.image?`<img src="${p.image}" alt="">`:String(i+1).padStart(2,'0')}</span><span class="piece-row-text"><strong>${esc(p.name)}</strong><span>${measure(p.w)} × ${measure(p.h)}</span></span><span class="chevron" aria-hidden="true">›</span></button>`).join(''):'<p class="muted">No pieces yet. Add your first frame, mirror, or keepsake.</p>';
  $$('[data-layout]').forEach(b=>{b.classList.toggle('selected',b.dataset.layout===state.style);b.setAttribute('aria-pressed',b.dataset.layout===state.style)});
  $('#undo').disabled=!history.length;$('#redo').disabled=!future.length;updateStatus();
}
function updateStatus(){
  const v=issues(state),warnIds=new Set([...v.outside,...v.overlap.flat()]);
  $$('.piece').forEach(el=>el.classList.toggle('warn',warnIds.has(el.dataset.piece)));
  let text='Your pieces have room to breathe.',warning=false;
  if(!state.items.length)text='Add your pieces to see what fits.';
  else if(v.outside.length){text=`${v.outside.length} ${v.outside.length===1?'piece extends':'pieces extend'} beyond the wall. Move or resize before hanging.`;warning=true}
  else if(v.overlap.length){text=`${v.overlap.length} overlapping ${v.overlap.length===1?'pair':'pairs'}. Move pieces apart or choose an automatic layout.`;warning=true}
  else if(v.spacing.length){text=`Some pieces have less than ${measure(state.gap)} between their outside bounds.`;warning=true}
  else if(v.margin.length){text=`Some pieces are closer than ${measure(state.margin)} to a wall edge.`;warning=true}
  $('#status-text').textContent=text;$('#status').classList.toggle('warning',warning);$('.status-symbol').textContent=warning?'!':'✓';
  const b=bounds(state.items);$('#composition-size').textContent=state.items.length?`${number(display(b.w))} × ${number(display(b.h))} ${state.unit} overall`:'';
  studio?.sync();
}
function arrangeWall(style=state.style){
  const r=arrange(state,style,variation++);
  if(!r.ok){toast(r.message);return {ok:false,message:r.message}}
  commit(()=>{state.items=r.items;state.style=style;selected=null});
  const b=bounds(state.items),actual=state.wall.h-b.y-b.h/2;
  toast(Math.abs(actual-state.center)>.1?'Arranged! The center moved slightly to keep everything inside your edge distance.':'Arranged. Drag any piece to make it your own.');
  return {ok:true,count:state.items.length,width:b.w,height:b.h,unit:'in'};
}
$$('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab,true)));
$('.step-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const names=['wall','pieces','layout'];setTab(names[(names.indexOf(tab)+(e.key==='ArrowRight'?1:2))%3]);$('#tab-'+tab).focus()});
$$('[data-next]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.next,true)));
$('#units').addEventListener('change',e=>commit(()=>state.unit=e.target.value));
function measuredInput(selector,getRange,action){$(selector).addEventListener('change',e=>{const n=toIn(e.target.value),[min,max]=getRange();if(!e.target.value.trim()||!Number.isFinite(n)||n<min||n>max){toast(`Enter a measurement between ${measure(min)} and ${measure(max)}.`);render();return}commit(()=>action(n))})}
measuredInput('#wall-width',()=>[12,1200],v=>{state.wall.w=v;state.margin=Math.min(state.margin,Math.min(v,state.wall.h)/2)});
measuredInput('#wall-height',()=>[12,1200],v=>{state.wall.h=v;state.center=Math.min(state.center,v);state.margin=Math.min(state.margin,Math.min(v,state.wall.w)/2)});
measuredInput('#gap',()=>[0,24],v=>state.gap=v);measuredInput('#center-height',()=>[0,state.wall.h],v=>state.center=v);measuredInput('#margin',()=>[0,Math.min(state.wall.w,state.wall.h)/2],v=>state.margin=v);
$('#show-measurements').addEventListener('change',e=>{showMeasurements=e.target.checked;render();saveDraft()});$('#show-grid').addEventListener('change',e=>{showGrid=e.target.checked;render();saveDraft()});$('#snap').addEventListener('change',e=>{snap=e.target.checked;saveDraft()});
function changeView(isPlan){planView=isPlan;$('#photo-view').classList.toggle('active',!isPlan);$('#plan-view').classList.toggle('active',isPlan);$('#photo-view').setAttribute('aria-pressed',!isPlan);$('#plan-view').setAttribute('aria-pressed',isPlan);render();saveDraft()}
$('#photo-view').addEventListener('click',()=>changeView(false));$('#plan-view').addEventListener('click',()=>changeView(true));
$('#arrange').addEventListener('click',()=>arrangeWall());$$('[data-layout]').forEach(b=>b.addEventListener('click',()=>arrangeWall(b.dataset.layout)));
function undo(){if(!history.length)return;future.push(snapshot());state=history.pop();selected=null;changed();render()}
function redo(){if(!future.length)return;history.push(snapshot());state=future.pop();selected=null;changed();render()}
$('#undo').addEventListener('click',undo);$('#redo').addEventListener('click',redo);
document.addEventListener('keydown',e=>{if($('dialog[open]')||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(studio?.active&&studio.hasDraft()){toast('Apply your piece edits before using Undo.');return}e.shiftKey?redo():undo()}});
$$('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$('#help').addEventListener('click',()=>$('#help-dialog').showModal());
function confirmAction(title,message,action){$('#confirm-title').textContent=title;$('#confirm-message').textContent=message;$('#confirm-yes').onclick=()=>{$('#confirm-dialog').close();action()};$('#confirm-dialog').showModal()}
$('#confirm-cancel').addEventListener('click',()=>$('#confirm-dialog').close());
$('#clear-pieces').addEventListener('click',()=>{if(state.items.length)confirmAction('Clear all pieces?','This removes every piece from your wall. You can undo it.',()=>commit(()=>{state.items=[];selected=null}))});
function openPiece(id=null,details=false){
  if(studio?.active&&!details){id?studio.inspect(id):studio.add();return}
  if(!id&&state.items.length>=40){toast('This wall supports up to 40 pieces.');return}
  editing=id;const p=id?state.items.find(p=>p.id===id):{name:'',w:12,h:16,shape:'rectangle',color:'#453c32',image:null,rotation:0};if(!p)return;
  selected=id;draftImage=p.image;draftRotation=p.rotation;
  $('#piece-dialog-title').textContent=id?'Make it yours':'Add a piece';$('#submit-piece').textContent=id?'Save changes':'Add to wall';$('#piece-name').value=p.name;$('#piece-shape').value=p.shape;$('#piece-color').value=p.color;
  setInput('#piece-width',p.w,.25,600);setInput('#piece-height',p.h,.25,600);if(id){setInput('#piece-x',p.x,-1200,1200);setInput('#piece-y',p.y,-1200,1200)}
  $('#piece-hanging-status').textContent=hangingStatus(p).label;$('#piece-position').hidden=!id;$('#delete-piece').hidden=!id;$('#piece-error').textContent='';updateShape();updatePiecePhoto();pieceFields=Object.fromEntries(['width','height','x','y'].map(id=>[id,$('#piece-'+id).value]));$('#piece-dialog').showModal();
}
function updateShape(){const equal=['circle','square'].includes($('#piece-shape').value);$('#piece-height').readOnly=equal;if(equal)$('#piece-height').value=$('#piece-width').value;$('#shape-note').textContent=equal?'Width and height stay equal for this shape.':'Include the frame in your measurements.'}
$('#piece-shape').addEventListener('change',updateShape);$('#piece-width').addEventListener('input',updateShape);
$('#add-piece').addEventListener('click',()=>openPiece());$('#empty-add').addEventListener('click',()=>openPiece());$('#piece-list').addEventListener('click',e=>{const b=e.target.closest('[data-edit]');if(b)openPiece(b.dataset.edit)});
$$('[data-color]').forEach(b=>b.addEventListener('click',()=>$('#piece-color').value=b.dataset.color));
$('#rotate-piece').addEventListener('click',()=>{const w=$('#piece-width').value;$('#piece-width').value=$('#piece-height').value;$('#piece-height').value=w;draftRotation=(draftRotation+90)%360;pieceFields.width=null;pieceFields.height=null;updateShape()});
$('#remove-piece-photo').insertAdjacentHTML('afterend','<button id="crop-piece-photo" type="button" class="text-button" hidden>Crop & straighten</button>');
$('.piece-photo-row').insertAdjacentHTML('afterend','<p class="field-note">Use a straight-on photo of your piece. Crop & straighten lets you mark its outer corners; the photo fills the selected shape.</p>');
function updatePiecePhoto(){$('#piece-photo-preview').hidden=!draftImage;$('#remove-piece-photo').hidden=!draftImage;$('#crop-piece-photo').hidden=!draftImage;$('#add-piece-photo').textContent=draftImage?'Change piece photo':'Add a photo of this piece';if(draftImage)$('#piece-photo-preview').src=draftImage;else $('#piece-photo-preview').removeAttribute('src')}
$('#crop-piece-photo').addEventListener('click',()=>startCalibration(draftImage,[{x:.01,y:.01},{x:.99,y:.01},{x:.99,y:.99},{x:.01,y:.99}],'piece'));
$('#add-piece-photo').addEventListener('click',()=>{$('#piece-file').value='';$('#piece-file').click()});$('#remove-piece-photo').addEventListener('click',()=>{draftImage=null;updatePiecePhoto()});
$('#piece-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{draftImage=await readPhoto(file,1000);updatePiecePhoto()}catch(error){$('#piece-error').textContent=error.message}});
$('#piece-form').addEventListener('submit',e=>{
  e.preventDefault();const old=editing?state.items.find(p=>p.id===editing):null;
  const read=(id,key)=>old&&$('#piece-'+id).value===pieceFields[id]?old[key]:toIn($('#piece-'+id).value);
  const name=$('#piece-name').value.trim(),w=read('width','w'),shape=$('#piece-shape').value;
  const h=['square','circle'].includes(shape)?w:read('height','h');
  if(!name||![w,h].every(v=>Number.isFinite(v)&&v>=.25&&v<=600)){$('#piece-error').textContent='Enter a name and valid outside dimensions.';return}
  let p={id:editing||crypto.randomUUID(),name,shape,w,h,hanging:cloneHanging(old?.hanging),color:$('#piece-color').value,image:draftImage,rotation:draftRotation,x:old?read('x','x'):(state.wall.w-w)/2,y:old?read('y','y'):clamp(state.wall.h-state.center-h/2,0,Math.max(0,state.wall.h-h))};
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1200||Math.abs(p.y)>1200){$('#piece-error').textContent='Enter a valid position.';return}
  p=reconcileHanging(old,p);
  commit(()=>{if(old)state.items=state.items.map(t=>t.id===p.id?p:t);else state.items.push(p);selected=p.id});$('#piece-dialog').close();
  if(e.submitter?.id==='piece-hangers'){hangingEditor.open(p.id);return}
  if(!old){toast('Piece added. Drag it into place or choose an arrangement.');setTab('pieces')}
});
$('#delete-piece').addEventListener('click',()=>{commit(()=>{state.items=state.items.filter(p=>p.id!==editing);selected=null});$('#piece-dialog').close()});
function setPiecePosition(el,p){el.style.left=`${p.x/state.wall.w*100}%`;el.style.top=`${p.y/state.wall.h*100}%`;el.setAttribute('aria-label',`${p.name}. Left ${measure(p.x)}, top ${measure(p.y)}. Enter to edit.`)}
$('#pieces-layer').addEventListener('pointerdown',e=>{
  const el=e.target.closest('[data-piece]');if(!el||e.button!==0||e.isPrimary===false||drag||!studio?.allowPieceDrag())return;const p=state.items.find(p=>p.id===el.dataset.piece);if(!p)return;
  selected=p.id;studio?.selectionChanged();$$('.piece').forEach(n=>n.classList.toggle('selected',n===el));el.focus({preventScroll:true});el.setPointerCapture(e.pointerId);
  drag={id:p.id,el,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,x:p.x,y:p.y,moved:false,rect:$('#wall').getBoundingClientRect()};e.preventDefault();
});
$('#pieces-layer').addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pointer)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
  if(!drag.moved&&Math.hypot(dx,dy)<4)return;
  if(!drag.moved){remember();drag.moved=true;dirty=true}
  const p=state.items.find(p=>p.id===drag.id),step=state.unit==='cm'?.5/2.54:.25;let x=drag.x+dx/drag.rect.width*state.wall.w,y=drag.y+dy/drag.rect.height*state.wall.h;
  if(snap){x=Math.round(x/step)*step;y=Math.round(y/step)*step}
  p.x=clamp(x,0,Math.max(0,state.wall.w-p.w));p.y=clamp(y,0,Math.max(0,state.wall.h-p.h));setPiecePosition(drag.el,p);updateStatus();e.preventDefault();
});
function endDrag(e,cancelled=false){if(!drag||drag.pointer!==e.pointerId)return;const current=drag;drag=null;if(current.el.hasPointerCapture(e.pointerId))current.el.releasePointerCapture(e.pointerId);if(current.moved){changed();render();$(`[data-piece="${CSS.escape(current.id)}"]`)?.focus({preventScroll:true})}else if(!cancelled)openPiece(current.id)}
$('#pieces-layer').addEventListener('pointerup',e=>endDrag(e));$('#pieces-layer').addEventListener('pointercancel',e=>endDrag(e,true));
$('#pieces-layer').addEventListener('keydown',e=>{
  const el=e.target.closest('[data-piece]');if(!el)return;const p=state.items.find(p=>p.id===el.dataset.piece);if(!p)return;
  if(e.key==='Enter'||e.key===' '){e.preventDefault();openPiece(p.id);return}
  if(studio?.active&&!studio.allowPieceDrag())return;
  const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!moves[e.key])return;e.preventDefault();const d=moves[e.key],step=(state.unit==='cm'?.5/2.54:.25)*(e.shiftKey?4:1);
  commit(()=>{p.x=clamp(p.x+d[0]*step,0,Math.max(0,state.wall.w-p.w));p.y=clamp(p.y+d[1]*step,0,Math.max(0,state.wall.h-p.h));selected=p.id});$(`[data-piece="${CSS.escape(p.id)}"]`)?.focus({preventScroll:true});
});
async function loadImage(src){const img=new Image();img.src=src;await img.decode();return img}
async function readPhoto(file,maxSize=1800){
  pendingOperations++;
  try{return await readPhotoData(file,maxSize)}finally{pendingOperations--}
}
async function readPhotoData(file,maxSize=1800){
  if(file.size>25*1024*1024)throw Error('Choose a photo smaller than 25 MB.');
  if(file.type==='image/svg+xml')throw Error('Choose a JPEG, PNG, WebP, or another supported photo format.');
  const url=URL.createObjectURL(file);try{const img=await loadImage(url);if(img.width*img.height>80000000)throw Error('Choose a smaller photo.');const scale=Math.min(1,maxSize/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.9)}catch(e){throw Error(e.message==='Choose a smaller photo.'?e.message:'That photo could not be read. Try a JPEG or PNG.')}finally{URL.revokeObjectURL(url)}
}
$('#upload-wall').addEventListener('click',()=>{$('#wall-file').value='';$('#wall-file').click()});
$('#wall-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const photo=await readPhoto(file);await startCalibration(photo,defaultCorners())}catch(error){toast(error.message)}});
$('#recalibrate').addEventListener('click',()=>startCalibration(state.rawPhoto,state.corners));
$('#remove-photo').addEventListener('click',()=>commit(()=>{state.photo=null;state.rawPhoto=null;state.corners=defaultCorners()}));
function sizeCalibration(){const img=$('#calibration-image');if(img.naturalWidth)$('#calibration-stage').style.maxWidth=`${innerHeight*.51*img.naturalWidth/img.naturalHeight}px`}
async function startCalibration(photo,corners,mode='wall'){
  try{pendingPhoto=photo;calibrationMode=mode;calibrationCorners=corners.map(p=>({...p}));$('#calibration-image').src=photo;await $('#calibration-image').decode();sizeCalibration();updateCorners();$('#calibration-error').textContent='';$('#calibration-dialog h2').textContent=mode==='wall'?'Where does your wall begin?':'Bring your piece into focus.';$('#calibration-dialog > p').textContent=mode==='wall'?'Move the four numbered corners onto the wall rectangle you measured. Leave furniture and floors outside it. We’ll straighten the perspective.':'Move the four corners onto the outside edges of your piece, including its frame. For a curved shape, mark the surrounding rectangle. We’ll crop and straighten the photo.';$('#calibration-dimensions').textContent=mode==='wall'?`${measure(state.wall.w)} × ${measure(state.wall.h)}`:`${$('#piece-width').value} × ${$('#piece-height').value} ${state.unit}`;$('#apply-calibration').textContent=mode==='wall'?'Use this wall':'Use this crop';$('#calibration-dialog').showModal()}catch{toast('That photo could not be opened. Please choose it again.')}
}
window.addEventListener('resize',sizeCalibration);
function updateCorners(){$$('[data-corner]').forEach((b,i)=>{b.style.left=`${calibrationCorners[i].x*100}%`;b.style.top=`${calibrationCorners[i].y*100}%`});$('#calibration-polygon').setAttribute('points',calibrationCorners.map(p=>`${p.x*1000},${p.y*1000}`).join(' '))}
$$('[data-corner]').forEach(b=>{
  b.addEventListener('pointerdown',e=>{b.setPointerCapture(e.pointerId);calibrationDrag={i:Number(b.dataset.corner),id:e.pointerId};e.preventDefault()});
  b.addEventListener('pointermove',e=>{if(!calibrationDrag||calibrationDrag.id!==e.pointerId)return;const r=$('#calibration-stage').getBoundingClientRect();calibrationCorners[calibrationDrag.i]={x:clamp((e.clientX-r.left)/r.width,0,1),y:clamp((e.clientY-r.top)/r.height,0,1)};updateCorners()});
  for(const event of ['pointerup','pointercancel'])b.addEventListener(event,()=>calibrationDrag=null);
  b.addEventListener('keydown',e=>{const dirs={ArrowLeft:[-.005,0],ArrowRight:[.005,0],ArrowUp:[0,-.005],ArrowDown:[0,.005]};if(!dirs[e.key])return;e.preventDefault();const p=calibrationCorners[Number(b.dataset.corner)],d=dirs[e.key];p.x=clamp(p.x+d[0],0,1);p.y=clamp(p.y+d[1],0,1);updateCorners()});
});
async function rectifyPhoto(src,corners,dimensions=state.wall){
  const img=await loadImage(src),source=document.createElement('canvas');source.width=img.width;source.height=img.height;const ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const from=ctx.getImageData(0,0,img.width,img.height).data;
  const scale=1400/Math.max(dimensions.w,dimensions.h),out=document.createElement('canvas');out.width=Math.max(8,Math.round(dimensions.w*scale));out.height=Math.max(8,Math.round(dimensions.h*scale));const dest=out.getContext('2d'),data=dest.createImageData(out.width,out.height),project=homography(corners);
  // Inverse mapping avoids holes and preserves the measured rectangular scale.
  for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++){
    const p=project(x/(out.width-1),y/(out.height-1)),sx=clamp(p.x*(img.width-1),0,img.width-1),sy=clamp(p.y*(img.height-1),0,img.height-1),x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(x0+1,img.width-1),y1=Math.min(y0+1,img.height-1),fx=sx-x0,fy=sy-y0,o=(y*out.width+x)*4;
    for(let c=0;c<3;c++)data.data[o+c]=(from[(y0*img.width+x0)*4+c]*(1-fx)+from[(y0*img.width+x1)*4+c]*fx)*(1-fy)+(from[(y1*img.width+x0)*4+c]*(1-fx)+from[(y1*img.width+x1)*4+c]*fx)*fy;
    data.data[o+3]=255;
  }
  dest.putImageData(data,0,0);return out.toDataURL('image/jpeg',.92);
}
$('#apply-calibration').addEventListener('click',async()=>{
  if(!validCorners(calibrationCorners)){$('#calibration-error').textContent='Keep the corners in clockwise order and spread them over a clear rectangle.';return}
  const dimensions=calibrationMode==='wall'?state.wall:{w:toIn($('#piece-width').value),h:toIn($('#piece-height').value)};
  if(![dimensions.w,dimensions.h].every(n=>Number.isFinite(n)&&n>0)){$('#calibration-error').textContent='Enter valid dimensions before cropping your photo.';return}
  const button=$('#apply-calibration');button.disabled=true;button.textContent='Preparing your photo…';
  try{await new Promise(resolve=>setTimeout(resolve,25));const photo=await rectifyPhoto(pendingPhoto,calibrationCorners,dimensions);if(calibrationMode==='wall'){commit(()=>{state.photo=photo;state.rawPhoto=pendingPhoto;state.corners=calibrationCorners.map(p=>({...p}))});toast('Your wall is calibrated. Add your pieces to see them in place.')}else{draftImage=photo;draftRotation=0;updatePiecePhoto()}$('#calibration-dialog').close()}catch{$('#calibration-error').textContent='We couldn’t prepare that photo. Please try again.'}finally{button.disabled=false;button.textContent=calibrationMode==='wall'?'Use this wall':'Use this crop'}
});
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
$('#save-project').addEventListener('click',()=>{download(new Blob([JSON.stringify({format:'wallstory',version:1,state})],{type:'application/json'}),'my-gallery.wallstory');dirty=false;toast('Project download started. Keep the file to reopen this wall.')});
$('#open-project').addEventListener('click',()=>{$('#project-file').value='';$('#project-file').click()});
$('#project-file').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  pendingOperations++;
  try{if(file.size>60*1024*1024)throw Error('Choose a project smaller than 60 MB.');const restored=validateProject(JSON.parse(await file.text()));const apply=()=>{commit(()=>{state=restored;selected=null});dirty=false;toast('Your gallery is ready to continue.')};if(dirty)confirmAction('Open this saved wall?','This will replace your current wall. You can undo the change.',apply);else apply()}catch(error){toast(error instanceof SyntaxError?'That file is not a valid Wallstory project.':error.message)}finally{pendingOperations--}
});
window.addEventListener('beforeunload',e=>{if((dirty&&(!autosaver||!autosaver.isSaved()))||drag?.moved||$('#piece-dialog').open||$('#calibration-dialog').open||hangingEditor?.hasDraft()||studio?.hasDraft()||studio?.isBusy()){e.preventDefault();e.returnValue=''}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&(drag?.moved||studio?.isBusy()))saveDraft()});
window.addEventListener('pagehide',()=>{if(drag?.moved||studio?.isBusy())saveDraft()});
function guideContent(interactive=true){return buildHangingGuide(state,interactive)}
function openGuide(){if(!state.items.length){toast('Add a piece to create a hanging guide.');return}$('#guide-content').innerHTML=guideContent();$('#guide-dialog').showModal()}
$('#guide-button').addEventListener('click',openGuide);
$('#guide-content').addEventListener('click',e=>{const button=e.target.closest('[data-guide-hanging]');if(button){$('#guide-dialog').close();hangingEditor.open(button.dataset.guideHanging)}});
$('#download-nail-map').addEventListener('click',()=>{download(new Blob([hangingMap(state,true)],{type:'image/svg+xml'}),'wallstory-nail-map.svg');toast('Nail map downloaded. Use the guide tables for exact measurements.')});
$('#print-guide').addEventListener('click',()=>window.print());
$('#download-guide').addEventListener('click',()=>{
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wallstory · Hanging Guide</title><style>body{font-family:Arial,sans-serif;color:#253e32;max-width:1000px;margin:36px auto;padding:20px;line-height:1.6;font-size:14px}h1{font-size:28px}.guide-summary{display:flex;gap:24px;flex-wrap:wrap;padding:15px;background:#f1f4e9;margin:20px 0}.guide-diagram{width:100%;max-height:430px}.guide-table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:12px;margin:22px 0}td,th{text-align:left;border-bottom:1px solid #dce3d7;padding:10px}.muted,.field-note{color:#64745e}.guide-section-title{margin:26px 0 8px}.guide-nail-card{break-inside:avoid;border:1px solid #dce3d7;border-radius:8px;padding:14px;margin:18px 0}.guide-point-status{padding:12px;border:1px solid #dce3d7;margin:12px 0}.guide-warning{background:#faeadf;padding:12px;color:#85442b}@media print{body{margin:0;padding:0}.guide-diagram{max-height:300px}tr{break-inside:avoid}table{font-size:10px}}</style></head><body><h1>Wallstory · Your hanging guide</h1>${guideContent(false)}<p class="field-note">Use your browser’s Print command to save a PDF.</p></body></html>`;
  download(new Blob([html],{type:'text/html'}),'wallstory-hanging-guide.html');toast('Hanging guide download started.');
});
function traceShape(ctx,p,w,h){ctx.beginPath();if(p.shape==='circle'||p.shape==='oval')ctx.ellipse(w/2,h/2,w/2,h/2,0,0,Math.PI*2);else if(p.shape==='hexagon'){ctx.moveTo(w*.25,0);ctx.lineTo(w*.75,0);ctx.lineTo(w,h/2);ctx.lineTo(w*.75,h);ctx.lineTo(w*.25,h);ctx.lineTo(0,h/2);ctx.closePath()}else if(p.shape==='arch'){ctx.moveTo(0,h);ctx.lineTo(0,h/2);ctx.ellipse(w/2,h/2,w/2,h/2,0,Math.PI,Math.PI*2);ctx.lineTo(w,h);ctx.closePath()}else ctx.rect(0,0,w,h)}
async function exportImage(){
  const button=$('#export-image');button.disabled=true;button.textContent='Preparing…';
  try{
    const scale=1800/Math.max(state.wall.w,state.wall.h),w=Math.round(state.wall.w*scale),h=Math.round(state.wall.h*scale),padding=60,c=document.createElement('canvas');c.width=w+padding*2;c.height=h+padding*2+65;const ctx=c.getContext('2d');ctx.fillStyle='#faf9f4';ctx.fillRect(0,0,c.width,c.height);ctx.save();ctx.translate(padding,padding);ctx.fillStyle='#fffdf7';ctx.fillRect(0,0,w,h);
    if(!planView){const img=await loadImage(state.photo||'./sample-wall.webp');ctx.drawImage(img,0,0,img.width,state.photo?img.height:img.height/1.205,0,0,w,h)}
    ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
    for(let i=0;i<state.items.length;i++){
      const p=state.items[i],pw=p.w*scale,ph=p.h*scale,odd=p.rotation%180!==0,bw=odd?ph:pw,bh=odd?pw:ph;ctx.save();ctx.translate(p.x*scale+pw/2,p.y*scale+ph/2);ctx.rotate(p.rotation*Math.PI/180);ctx.translate(-bw/2,-bh/2);traceShape(ctx,p,bw,bh);ctx.fillStyle=p.color;ctx.shadowColor='#29231b44';ctx.shadowBlur=7;ctx.shadowOffsetX=3;ctx.shadowOffsetY=5;ctx.fill();ctx.shadowColor='transparent';const inset=p.image?0:.06,inner=1-inset*2;ctx.translate(bw*inset,bh*inset);traceShape(ctx,p,bw*inner,bh*inner);ctx.clip();ctx.fillStyle='#e9e4d9';ctx.fill();
      if(p.image){const img=await loadImage(p.image),s=Math.max(bw/img.width,bh/img.height);ctx.drawImage(img,(bw-img.width*s)/2,(bh-img.height*s)/2,img.width*s,img.height*s)}else{ctx.fillStyle='#756b5c';ctx.font=`italic ${Math.max(16,Math.min(bw,bh)*.22)}px Georgia`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i+1).padStart(2,'0'),bw*.44,bh*.44)}ctx.restore();
      if(showMeasurements){const text=`${i+1} · ${number(display(p.w))} × ${number(display(p.h))} ${state.unit}`;ctx.font='14px Arial';ctx.textAlign='center';const tw=ctx.measureText(text).width;ctx.fillStyle='#fffdf5ed';ctx.fillRect(p.x*scale+pw/2-tw/2-5,p.y*scale-23,tw+10,19);ctx.fillStyle='#314a3a';ctx.fillText(text,p.x*scale+pw/2,p.y*scale-9)}
    }
    ctx.restore();ctx.strokeStyle='#a9b69f';ctx.lineWidth=1;ctx.strokeRect(0,0,w,h);ctx.font='18px Arial';ctx.fillStyle='#64765e';ctx.textAlign='center';ctx.fillText(measure(state.wall.w),w/2,-22);ctx.save();ctx.translate(-25,h/2);ctx.rotate(-Math.PI/2);ctx.fillText(measure(state.wall.h),0,0);ctx.restore();ctx.restore();ctx.fillStyle='#214b3f';ctx.font='bold 27px Arial';ctx.textAlign='left';ctx.fillText('wallstory.',padding,c.height-48);ctx.fillStyle='#6d7b65';ctx.font='15px Arial';ctx.fillText('Preview only · See hanging guide for exact placement measurements.',padding,c.height-21);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!blob)throw Error();download(blob,'my-gallery-wall.png');toast('Wall image download started.');
  }catch{toast('The image could not be exported. Save the project and try again.')}finally{button.disabled=false;button.textContent='Export image'}
}
$('#export-image').addEventListener('click',exportImage);
hangingEditor=createHangingEditor({
  piece:id=>state.items.find(p=>p.id===id),unit:()=>state.unit,shape:svgShape,confirm:confirmAction,toast,
  save:(id,hanging)=>{
    const candidate={...state,items:state.items.map(p=>p.id===id?{...p,hanging}:p)};
    const checked=validateProject({format:'wallstory',version:1,state:candidate});
    commit(()=>{state=checked;selected=id});
  }
});
// Optional browser-native tools share the same validated actions as the UI.
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  const register=t=>{try{Promise.resolve(document.modelContext.registerTool(t,{signal:lifecycle.signal})).catch(()=>{})}catch{}};
  register({name:'read_gallery_plan',title:'Read gallery plan',description:'Read current wall and piece measurements in inches, including fit warnings. Does not return photo data.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({wall:{...state.wall},gap:state.gap,margin:state.margin,center:state.center,style:state.style,unit:'in',items:state.items.map(({image,...p})=>p),warnings:issues(state)})});
  register({name:'arrange_gallery_wall',title:'Arrange gallery wall',description:'Apply an automatic gallery layout to the current pieces using their real sizes and the existing spacing and wall measurements. Updates the visible plan. Does not save a file.',inputSchema:{type:'object',properties:{style:{type:'string',enum:['balanced','grid','salon','row','stair']}},required:['style'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(!input||!['balanced','grid','salon','row','stair'].includes(input.style)||Object.keys(input).some(k=>k!=='style'))throw Error('Choose a supported layout style.');const result=arrangeWall(input.style);if(!result.ok)throw Error(result.message);return result}});
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
studio=createStudio({
  get:()=>({state,selected,canUndo:!!history.length,canRedo:!!future.length,view:{planView,showMeasurements,showGrid,snap}}),
  select:id=>{selected=id;$$('.piece').forEach(el=>el.classList.toggle('selected',el.dataset.piece===id))},
  applyPiece:(piece,adding=false)=>{
    piece=reconcileHanging(adding?null:state.items.find(p=>p.id===piece.id),piece);
    const candidate={...state,items:adding?[...state.items,piece]:state.items.map(p=>p.id===piece.id?piece:p)};
    const checked=validateProject({format:'wallstory',version:1,state:candidate});
    commit(()=>{state=checked;selected=piece.id});
  },
  remove:id=>commit(()=>{state.items=state.items.filter(p=>p.id!==id);selected=null}),
  beginGesture:remember,
  previewPiece:piece=>{
    const p=state.items.find(p=>p.id===piece.id);if(!p)return;Object.assign(p,reconcileHanging(p,piece));dirty=true;
    const el=$(`[data-piece="${CSS.escape(p.id)}"]`);if(el){setPiecePosition(el,p);el.style.width=`${p.w/state.wall.w*100}%`;el.style.height=`${p.h/state.wall.h*100}%`;el.querySelector('.piece-body').style.cssText=bodyStyle(p);el.querySelector('.piece-label').textContent=`${number(display(p.w))} × ${number(display(p.h))}`}
    updateStatus();
  },
  endGesture:()=>{changed();render()},
  finishDrag:()=>{if(drag)endDrag({pointerId:drag.pointer},true)},
  undo,redo,confirm:confirmAction,toast,
  details:id=>openPiece(id,true),
  hangers:id=>hangingEditor.open(id),
  hangingStatus,guide:openGuide,
  arrange:(style,gap,margin)=>{
    const proposed={...state,gap,margin};const result=arrange(proposed,style,variation++);
    if(!result.ok){toast(result.message);return}
    commit(()=>{state={...proposed,style,items:result.items};selected=null});toast('Wall arranged. Every piece keeps its actual size.');
  },
  setView:(key,value)=>{
    if(key==='planView'){changeView(value);return}
    if(key==='showMeasurements'){showMeasurements=value;$('#show-measurements').checked=value}
    if(key==='showGrid'){showGrid=value;$('#show-grid').checked=value}
    if(key==='snap'){snap=value;$('#snap').checked=value}
    render();saveDraft();
  },
  export:exportImage,
  backup:()=>$('#save-project').click()
});
// Hold editing until recovery finishes so a late read cannot replace a new edit.
const recovery=(async()=>{
  try{
    const store=createDraftStore(window.indexedDB,new URL('.',location.href).pathname);
    const saved=await store.load();
    if(saved){
      state=validateProject(saved);
      const view=saved.view||{};
      if(['wall','pieces','layout'].includes(view.tab))tab=view.tab;
      for(const key of ['planView','showMeasurements','showGrid','snap']){
        if(typeof view[key]!=='boolean')continue;
        if(key==='planView')planView=view[key];else if(key==='showMeasurements')showMeasurements=view[key];else if(key==='showGrid')showGrid=view[key];else snap=view[key];
      }
    }
    autosaver=createAutosaver(project=>store.write(project),autosaveStatus);
    $('#autosave-status').textContent=saved?'Your saved wall is restored on this device.':'Autosave is ready on this device.';
  }catch{
    autosaveStatus('error');
    // Leave an unreadable draft untouched. Manual project downloads still work.
  }finally{
    $('#show-measurements').checked=showMeasurements;$('#show-grid').checked=showGrid;$('#snap').checked=snap;
    changeView(planView);setTab(tab);
    initializing=false;
    $('#planner').inert=false;$('.header-actions').inert=false;
    $('#planner').setAttribute('aria-busy','false');
  }
})();
window.wallstoryProject={
  async prepareForUpdate(){
    await recovery;
    if($('dialog[open]')||drag||pendingOperations||studio?.hasDraft()||studio?.isBusy())throw Error('Finish your current edit or photo upload before updating.');
    if(!autosaver)throw Error('Autosave is unavailable. Download your project with Save project before reopening the app.');
    saveDraft();
    if(!(await autosaver.flush()))throw Error(autosaver.error()?.name==='DraftConflictError'?autosaver.error().message:'Your wall could not be saved. Free some device storage and try again, or download a project backup.');
  }
};
