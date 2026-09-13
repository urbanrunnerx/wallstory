const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
export function fitWall(viewportWidth,viewportHeight,wallWidth,wallHeight,padding=36){
  const scale=Math.max(.001,Math.min(Math.max(1,viewportWidth-padding*2)/wallWidth,Math.max(1,viewportHeight-padding*2)/wallHeight));
  return {width:wallWidth*scale,height:wallHeight*scale,scale};
}
export function zoomAt(view,zoom,point){
  const next=clamp(zoom,1,8),ratio=next/view.zoom;
  return {zoom:next,x:point.x-(point.x-view.x)*ratio,y:point.y-(point.y-view.y)*ratio};
}
export function constrainView(view,size,viewport){
  const maxX=Math.max(0,(size.width*view.zoom-viewport.width)/2+48),maxY=Math.max(0,(size.height*view.zoom-viewport.height)/2+48);
  return {...view,x:clamp(view.x,-maxX,maxX),y:clamp(view.y,-maxY,maxY)};
}
export function resizePiece(piece,corner,dx,dy,wall,keepRatio=false){
  const west=corner.includes('w'),north=corner.includes('n');
  const anchorX=west?piece.x+piece.w:piece.x,anchorY=north?piece.y+piece.h:piece.y;
  const maxW=Math.max(.25,Math.min(600,west?anchorX:wall.w-anchorX));
  const maxH=Math.max(.25,Math.min(600,north?anchorY:wall.h-anchorY));
  let w=piece.w+(west?-dx:dx),h=piece.h+(north?-dy:dy);
  if(keepRatio||['circle','square'].includes(piece.shape)){
    const factor=Math.abs(w/piece.w-1)>Math.abs(h/piece.h-1)?w/piece.w:h/piece.h;
    const minScale=Math.max(.25/piece.w,.25/piece.h),maxScale=Math.min(maxW/piece.w,maxH/piece.h);
    if(maxScale<minScale)return {...piece};
    const scale=clamp(factor,minScale,maxScale);
    w=piece.w*scale;h=piece.h*scale;
  }else{w=clamp(w,.25,maxW);h=clamp(h,.25,maxH)}
  return {...piece,w,h,x:west?anchorX-w:anchorX,y:north?anchorY-h:anchorY};
}
export function resizeFromCenter(piece,w,h,wall){
  return {...piece,w,h,x:clamp(piece.x+(piece.w-w)/2,0,Math.max(0,wall.w-w)),y:clamp(piece.y+(piece.h-h)/2,0,Math.max(0,wall.h-h))};
}
