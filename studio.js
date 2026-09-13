import {fitWall,zoomAt,constrainView,resizePiece,resizeFromCenter} from './studio-math.js';
const $=id=>document.getElementById(id);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createStudio(api){
  const root=$('wall-studio'),viewport=$('studio-viewport'),world=$('studio-world'),wall=$('wall'),selection=$('studio-selection');
  const home=wall.parentNode,homeNext=wall.nextSibling,main=$('planner'),header=document.querySelector('.header');
  let active=false,view={zoom:1,x:0,y:0},size={width:1,height:1},mode='pieces',editor=false,isNew=false,editId=null,formDirty=false,pan=false;
  let resizing=null,navigation=null,pointers=new Map(),wasFullscreen=false,locked=false,frame=0,oldFocus=null,oldMainInert=false,oldHeaderInert=false;
  let lastWall='',entry=0,listData=[];
  const unit=()=>api.get().state.unit;
  const factor=()=>unit()==='cm'?2.54:1;
  const show=n=>Number((n*factor()).toFixed(3));
  const parse=id=>Number($(id).value)/factor();
  const selected=()=>api.get().state.items.find(p=>p.id===api.get().selected);
  const modified=()=>formDirty||isNew;
  function guard(action){
    if(modified())api.confirm('Discard unapplied piece edits?','Your saved wall is safe. Apply changes first to keep what you entered in the piece panel.',()=>{formDirty=false;isNew=false;action()});
    else action();
  }
  function setPanel(open){root.classList.toggle('panel-closed',!open);$('studio-menu').setAttribute('aria-expanded',String(open));scheduleFit()}
  function setMode(next){mode=next;for(const name of ['pieces','layout','view']){$(`studio-${name}-panel`).hidden=name!==mode;root.querySelector(`[data-studio-tab="${name}"]`).setAttribute('aria-pressed',String(name===mode))}setPanel(true)}
  function scheduleFit(){cancelAnimationFrame(frame);frame=requestAnimationFrame(fit)}
  function fit(){
    if(!active)return;
    const visible=window.visualViewport;
    root.style.height=`${visible?.height||innerHeight}px`;
    root.style.top=`${visible?.offsetTop||0}px`;
    root.classList.toggle('keyboard-open',!!visible&&visible.height<innerHeight*.75);
    const state=api.get().state,r=viewport.getBoundingClientRect();
    size=fitWall(r.width,r.height,state.wall.w,state.wall.h,r.height<260?26:38);
    world.style.width=`${size.width}px`;world.style.height=`${size.height}px`;
    paintView();syncSelection();
  }
  function paintView(){
    const r=viewport.getBoundingClientRect();view=constrainView(view,size,r);
    world.style.transform=`translate(-50%,-50%) translate(${view.x}px,${view.y}px) scale(${view.zoom})`;
    world.style.setProperty('--inverse-zoom',1/view.zoom);
    $('studio-zoom').textContent=`${Math.round(view.zoom*100)}%`;
    $('studio-zoom-out').disabled=view.zoom<=1;$('studio-zoom-in').disabled=view.zoom>=8;
  }
  function zoom(value,point={x:0,y:0}){view=zoomAt(view,value,point);paintView()}
  function resetView(){view={zoom:1,x:0,y:0};fit()}
  function point(event){const r=viewport.getBoundingClientRect();return {x:event.clientX-r.left-r.width/2,y:event.clientY-r.top-r.height/2}}
  function syncSelection(){
    const model=api.get(),p=selected();selection.hidden=!p||isNew||pan;
    if(p){selection.style.left=`${p.x/model.state.wall.w*100}%`;selection.style.top=`${p.y/model.state.wall.h*100}%`;selection.style.width=`${p.w/model.state.wall.w*100}%`;selection.style.height=`${p.h/model.state.wall.h*100}%`}
  }
  function renderEditor(p){
    $('studio-name').value=p.name;$('studio-shape').value=p.shape;$('studio-color').value=p.color;
    for(const [id,key] of [['width','w'],['height','h'],['x','x'],['y','y']])$(`studio-${id}`).value=show(p[key]);
    $('studio-editor-title').textContent=isNew?'Add something you love':p.name;
    $('studio-editor-caption').textContent=isNew?'Give it a shape and its outside dimensions.':'Resize on the wall, or enter exact measurements.';
    $('studio-apply').textContent=isNew?'Add to wall':'Apply changes';
    $('studio-piece-actions').hidden=isNew;$('studio-position-fields').hidden=isNew;
    $('studio-form-error').textContent='';syncShape();
  }
  function syncShape(){
    const equal=['circle','square'].includes($('studio-shape').value);
    $('studio-height').readOnly=equal;if(equal)$('studio-height').value=$('studio-width').value;
    $('studio-ratio').disabled=equal;if(equal)$('studio-ratio').checked=true;
  }
  function sync(force=false){
    if(!active)return;
    const model=api.get(),state=model.state;
    $('studio-wall-size').textContent=`${show(state.wall.w)} × ${show(state.wall.h)} ${unit()}`;
    $('studio-undo').disabled=!model.canUndo;$('studio-redo').disabled=!model.canRedo;
    $('studio-add').disabled=state.items.length>=40;
    root.querySelectorAll('.studio-unit').forEach(el=>el.textContent=unit());
    for(const id of ['studio-width','studio-height']){$(id).min=.25*factor();$(id).max=600*factor()}
    $('studio-gap').max=24*factor();$('studio-margin').max=Math.min(state.wall.w,state.wall.h)/2*factor();
    for(const [id,key] of [['studio-gap','gap'],['studio-margin','margin']])if(document.activeElement!==$(id))$(id).value=show(state[key]);
    if(document.activeElement!==$('studio-layout'))$('studio-layout').value=state.style;
    for(const [id,key] of [['studio-plan','planView'],['studio-grid','showGrid'],['studio-measurements','showMeasurements'],['studio-snap','snap']])$(id).checked=model.view[key];
    if(editor&&!isNew&&!state.items.some(p=>p.id===editId)){editor=false;editId=null;formDirty=false}
    $('studio-piece-list').hidden=editor;$('studio-piece-form').hidden=!editor;$('studio-list-toggle').hidden=!editor;
    if(editor&&(force||!formDirty)&&!isNew){const p=state.items.find(p=>p.id===editId);if(p)renderEditor(p)}
    if(!editor){
      $('studio-editor-title').textContent=`Your collection · ${state.items.length}`;$('studio-editor-caption').textContent='Choose a piece, or add something new.';
      const rebuild=listData.length!==state.items.length||state.items.some((p,i)=>['id','name','shape','color','image'].some(k=>p[k]!==listData[i]?.[k]));
      if(rebuild||!$('studio-piece-list').children.length){
        $('studio-piece-list').innerHTML=state.items.length?state.items.map((p,i)=>`<button data-studio-piece="${esc(p.id)}" aria-label="Edit ${esc(p.name)}"><span class="studio-thumb ${p.shape}" style="--frame:${p.color}">${p.image?`<img src="${p.image}" alt="">`:String(i+1).padStart(2,'0')}</span><span><strong>${esc(p.name)}</strong><small>${show(p.w)} × ${show(p.h)} ${unit()}</small></span></button>`).join(''):'<p class="studio-small">Your wall is ready. Tap + Piece to start your collection.</p>';
        listData=state.items.map(p=>({...p}));
      }else $('studio-piece-list').querySelectorAll('small').forEach((el,i)=>{const p=state.items[i];el.textContent=`${show(p.w)} × ${show(p.h)} ${unit()}`});
    }
    syncSelection();syncStatus();
    const wallKey=`${state.wall.w}:${state.wall.h}`;if(lastWall!==wallKey){lastWall=wallKey;resetView()}
  }
  function syncStatus(){
    if(!active)return;
    $('studio-save-status').textContent=$('autosave-status').textContent;
    $('studio-save-status').dataset.error=$('save-strip').dataset.saveState==='error';
    $('studio-fit-status').textContent=$('status-text').textContent;
    $('studio-fit-status').dataset.warning=$('status').classList.contains('warning');
  }
  function inspect(id){guard(()=>{const p=api.get().state.items.find(p=>p.id===id);if(!p)return;editor=true;isNew=false;editId=id;formDirty=false;api.select(id);setMode('pieces');sync(true);$('studio-panel').scrollTop=0})}
  function add(){guard(()=>{if(api.get().state.items.length>=40){api.toast('This wall supports up to 40 pieces.');return}editor=true;isNew=true;editId=null;formDirty=false;api.select(null);setMode('pieces');sync();renderEditor({name:'',shape:'rectangle',w:12,h:16,x:0,y:0,color:'#453c32'});$('studio-ratio').checked=false;$('studio-panel').scrollTop=0;$('studio-name').focus({preventScroll:true})})}
  async function landscape(){
    const current=entry;
    try{
      if(!document.fullscreenElement&&document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen({navigationUI:'hide'});if(!active||current!==entry){await document.exitFullscreen?.();return}wasFullscreen=true}
      if(screen.orientation?.lock){await screen.orientation.lock('landscape');if(!active||current!==entry){screen.orientation.unlock?.();return}locked=true}
    }catch{if(active)$('studio-orientation').textContent='Turn your phone sideways. Enable auto-rotate if needed.'}
    if(active)scheduleFit();
  }
  function enter(){
    if(active)return;active=true;entry++;oldFocus=document.activeElement;oldMainInert=main.inert;oldHeaderInert=header.inert;
    root.hidden=false;document.body.classList.add('studio-open');main.inert=true;header.inert=true;
    world.insertBefore(wall,selection);editor=false;isNew=false;formDirty=false;setPanel(innerWidth>=600);sync();resetView();
    $('studio-menu').focus({preventScroll:true});void landscape();
  }
  function leave(exitNative=true){
    if(!active)return;
    if(resizing)finishResize();api.finishDrag();
    active=false;entry++;pointers.clear();navigation=null;
    if(homeNext&&homeNext.parentNode===home)home.insertBefore(wall,homeNext);else home.append(wall);
    root.hidden=true;document.body.classList.remove('studio-open');main.inert=oldMainInert;header.inert=oldHeaderInert;
    if(locked){try{screen.orientation.unlock()}catch{}locked=false}
    if(exitNative&&document.fullscreenElement&&wasFullscreen)void document.exitFullscreen().catch(()=>{});
    wasFullscreen=false;oldFocus?.focus({preventScroll:true});
  }
  $('studio-enter').addEventListener('click',enter);
  $('studio-exit').addEventListener('click',()=>guard(()=>leave()));
  $('studio-landscape').addEventListener('click',()=>void landscape());
  document.addEventListener('fullscreenchange',()=>{if(active&&wasFullscreen&&!document.fullscreenElement){wasFullscreen=false;/* Keep the workspace and unsubmitted form available after a system exit. */scheduleFit()}});
  document.addEventListener('keydown',e=>{
    if(!active||document.querySelector('dialog[open]'))return;
    if(e.key==='Escape'){e.preventDefault();guard(()=>leave());return}
    if(e.key==='Tab'){
      const all=[...root.querySelectorAll('button,input,select,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
      const first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
    }
  });
  $('studio-menu').addEventListener('click',()=>setPanel(root.classList.contains('panel-closed')));
  $('studio-close-panel').addEventListener('click',()=>setPanel(false));
  $('studio-add').addEventListener('click',add);
  $('studio-list-toggle').addEventListener('click',()=>guard(()=>{editor=false;editId=null;api.select(null);sync()}));
  root.querySelectorAll('[data-studio-tab]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.studioTab)));
  $('studio-piece-list').addEventListener('click',event=>{const b=event.target.closest('[data-studio-piece]');if(b)inspect(b.dataset.studioPiece)});
  $('studio-piece-form').addEventListener('input',()=>formDirty=true);
  $('studio-shape').addEventListener('change',syncShape);
  $('studio-width').addEventListener('input',syncShape);
  $('studio-piece-form').addEventListener('submit',event=>{
    event.preventDefault();
    try{
      const state=api.get().state,old=state.items.find(p=>p.id===editId);
      const name=$('studio-name').value.trim(),w=parse('studio-width'),h=parse('studio-height');
      if(!name||name.length>60||![w,h].every(n=>Number.isFinite(n)&&n>=.25&&n<=600))throw Error('Enter a name and outside dimensions between '+show(.25)+' and '+show(600)+' '+unit()+'.');
      const p={...(old||{id:crypto.randomUUID(),rotation:0,image:null}),name,w,h,shape:$('studio-shape').value,color:$('studio-color').value};
      if(isNew){p.x=(state.wall.w-w)/2;p.y=Math.max(0,state.wall.h-state.center-h/2)}
      else{
        const x=parse('studio-x'),y=parse('studio-y');
        if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>1200||Math.abs(y)>1200)throw Error('Enter valid left and top positions.');
        // Keep the center when only dimensions change; honor explicitly edited positions.
        const sized=resizeFromCenter(old,w,h,state.wall);
        p.x=Math.abs(x-old.x)<.0006?sized.x:x;p.y=Math.abs(y-old.y)<.0006?sized.y:y;
      }
      api.applyPiece(p,isNew);isNew=false;formDirty=false;editId=p.id;editor=true;sync(true);api.toast('Piece saved. Drag it into place or resize with the corner handles.');
    }catch(error){$('studio-form-error').textContent=error.message}
  });
  function action(fn){guard(()=>{const p=selected();if(p)fn(p)})}
  $('studio-undo').addEventListener('click',()=>guard(api.undo));$('studio-redo').addEventListener('click',()=>guard(api.redo));
  $('studio-rotate').addEventListener('click',()=>action(p=>api.applyPiece({...resizeFromCenter(p,p.h,p.w,api.get().state.wall),rotation:(p.rotation+90)%360})));
  $('studio-duplicate').addEventListener('click',()=>action(p=>{const state=api.get().state;if(state.items.length>=40){api.toast('This wall supports up to 40 pieces.');return}const copy={...p,id:crypto.randomUUID(),name:(p.name+' copy').slice(0,60),x:Math.max(0,Math.min(state.wall.w-p.w,p.x+p.w+state.gap)),y:p.y};api.applyPiece(copy,true);editId=copy.id;sync(true)}));
  $('studio-center-x').addEventListener('click',()=>action(p=>api.applyPiece({...p,x:(api.get().state.wall.w-p.w)/2})));
  $('studio-center-y').addEventListener('click',()=>action(p=>api.applyPiece({...p,y:(api.get().state.wall.h-p.h)/2})));
  $('studio-photo').addEventListener('click',()=>action(p=>api.details(p.id)));
  $('studio-delete').addEventListener('click',()=>action(p=>api.confirm('Delete this piece?',`Remove ${p.name} from your wall? You can undo this.`,()=>api.remove(p.id))));
  $('studio-arrange').addEventListener('click',()=>guard(()=>{
    const gap=parse('studio-gap'),margin=parse('studio-margin'),state=api.get().state;
    if(!Number.isFinite(gap)||gap<0||gap>24||!Number.isFinite(margin)||margin<0||margin>Math.min(state.wall.w,state.wall.h)/2){api.toast('Enter valid spacing and edge measurements.');return}
    api.arrange($('studio-layout').value,gap,margin);resetView();
  }));
  for(const [id,key] of [['studio-plan','planView'],['studio-grid','showGrid'],['studio-measurements','showMeasurements'],['studio-snap','snap']])$(id).addEventListener('change',()=>api.setView(key,$(id).checked));
  $('studio-export').addEventListener('click',()=>guard(api.export));$('studio-backup').addEventListener('click',()=>guard(api.backup));
  $('studio-pan').addEventListener('click',()=>{pan=!pan;viewport.classList.toggle('pan-mode',pan);$('studio-pan').setAttribute('aria-pressed',String(pan));syncSelection()});
  $('studio-fit').addEventListener('click',resetView);$('studio-zoom-in').addEventListener('click',()=>zoom(view.zoom*1.3));$('studio-zoom-out').addEventListener('click',()=>zoom(view.zoom/1.3));
  viewport.addEventListener('wheel',event=>{if(!active||resizing)return;event.preventDefault();zoom(view.zoom*Math.exp(-event.deltaY*.002),point(event))},{passive:false});
  viewport.addEventListener('dblclick',event=>{if(!event.target.closest('[data-piece],[data-resize],button'))resetView()});
  function startNavigation(){const points=[...pointers.values()];if(points.length>=2){const a=points[0],b=points[1];navigation={view:{...view},center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))}}}
  viewport.addEventListener('pointerdown',event=>{
    if(!active||event.button!==0||event.target.closest('[data-resize]'))return;
    if(resizing){event.stopPropagation();return}
    pointers.set(event.pointerId,point(event));
    if(pointers.size>=2){api.finishDrag();startNavigation();event.preventDefault();event.stopPropagation();for(const id of pointers.keys()){try{viewport.setPointerCapture(id)}catch{}}return}
    if(pan||!event.target.closest('[data-piece],button')){navigation={view:{...view},center:point(event),distance:null};viewport.setPointerCapture(event.pointerId);event.preventDefault();event.stopPropagation()}
  },true);
  viewport.addEventListener('pointermove',event=>{
    if(!active||!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,point(event));if(!navigation)return;
    event.preventDefault();event.stopPropagation();
    const points=[...pointers.values()];
    if(navigation.distance&&points.length>=2){const a=points[0],b=points[1],center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};view=zoomAt(navigation.view,navigation.view.zoom*Math.hypot(a.x-b.x,a.y-b.y)/navigation.distance,navigation.center);view.x+=center.x-navigation.center.x;view.y+=center.y-navigation.center.y}
    else{const p=point(event);view={...navigation.view,x:navigation.view.x+p.x-navigation.center.x,y:navigation.view.y+p.y-navigation.center.y}}
    paintView();
  },true);
  function endNavigation(event){
    if(!pointers.has(event.pointerId))return;
    pointers.delete(event.pointerId);
    if(navigation){event.stopPropagation();if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);navigation=null;/* Ignore a remaining finger until it is lifted, avoiding an accidental piece drag. */}
  }
  viewport.addEventListener('pointerup',endNavigation,true);viewport.addEventListener('pointercancel',endNavigation,true);
  selection.addEventListener('pointerdown',event=>{
    const handle=event.target.closest('[data-resize]'),p=selected();if(!handle||!p||event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    if(modified()){api.toast('Apply your piece edits before using the corner handles.');return}
    pointers.clear();navigation=null;api.finishDrag();
    resizing={id:event.pointerId,handle,corner:handle.dataset.resize,piece:{...p},x:event.clientX,y:event.clientY,rect:wall.getBoundingClientRect(),started:false};
    handle.setPointerCapture(event.pointerId);
  });
  selection.addEventListener('pointermove',event=>{
    if(!resizing||event.pointerId!==resizing.id)return;event.preventDefault();event.stopPropagation();
    const g=resizing,dx=event.clientX-g.x,dy=event.clientY-g.y;if(!g.started&&Math.hypot(dx,dy)<3)return;
    if(!g.started){api.beginGesture();g.started=true}
    const model=api.get(),state=model.state,step=unit()==='cm'?.5/2.54:.25;
    let mx=dx/g.rect.width*state.wall.w,my=dy/g.rect.height*state.wall.h;
    if(model.view.snap){mx=Math.round(mx/step)*step;my=Math.round(my/step)*step}
    const p=resizePiece(g.piece,g.corner,mx,my,state.wall,$('studio-ratio').checked);
    api.previewPiece(p);if(editor&&editId===p.id)renderEditor(p);
  });
  function finishResize(){if(!resizing)return;const g=resizing;resizing=null;if(g.handle.hasPointerCapture(g.id))g.handle.releasePointerCapture(g.id);if(g.started)api.endGesture();sync()}
  selection.addEventListener('pointerup',finishResize);selection.addEventListener('pointercancel',finishResize);selection.addEventListener('lostpointercapture',finishResize);
  selection.addEventListener('keydown',event=>{
    const handle=event.target.closest('[data-resize]'),p=selected();if(!handle||!p||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();if(modified())return;
    const step=(unit()==='cm'?.5/2.54:.25)*(event.shiftKey?4:1),dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;
    api.applyPiece(resizePiece(p,handle.dataset.resize,dx,dy,api.get().state.wall,$('studio-ratio').checked));
  });
  new ResizeObserver(scheduleFit).observe(viewport);
  window.addEventListener('resize',scheduleFit);window.visualViewport?.addEventListener('resize',scheduleFit);
  new MutationObserver(syncStatus).observe($('save-strip'),{subtree:true,childList:true,characterData:true,attributes:true});
  return {get active(){return active},get pan(){return pan},sync,inspect,add,hasDraft:modified,isBusy:()=>!!resizing||!!navigation,allowPieceDrag:()=>{if(active&&modified()){api.toast('Apply your piece edits before moving pieces.');return false}return true},selectionChanged:()=>{if(editor&&!modified()){editId=selected()?.id||null;sync()}else syncSelection()}};
}
