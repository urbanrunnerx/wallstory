// Inches throughout. x is measured from the LEFT while LOOKING AT THE BACK.
// The frame's current top stays at the top when turning it over horizontally.
const near=(a,b)=>Math.abs(a-b)<1e-6;
export const hangingBasis=p=>({w:p.w,h:p.h,rotation:p.rotation,shape:p.shape});
export const cloneHanging=h=>h?{...h,basis:{...h.basis},points:h.points.map(p=>({...p}))}:null;
export function validateHanging(h){
  if(h==null)return null;
  const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
  const b=h.basis;
  if(typeof h.confirmed!=='boolean'||!b||!finite(b.w,.25,600)||!finite(b.h,.25,600)||![0,90,180,270].includes(b.rotation)||!['rectangle','square','circle','oval','arch','hexagon'].includes(b.shape)||!Array.isArray(h.points)||h.points.length>12)throw Error('The hanging measurements are invalid.');
  const ids=new Set();
  const points=h.points.map(p=>{
    if(!p||typeof p.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(p.id)||ids.has(p.id)||!finite(p.x,0,600)||!finite(p.y,0,600)||!['direct','hook'].includes(p.kind)||!finite(p.rise,0,24)||(p.kind==='direct'&&p.rise!==0))throw Error('A hanging point contains invalid measurements.');
    ids.add(p.id);return {id:p.id,x:p.x,y:p.y,kind:p.kind,rise:p.rise};
  });
  if(h.confirmed&&(!points.length||points.some(p=>p.x>b.w+1e-6||p.y>b.h+1e-6)))throw Error('Confirmed hanging points must fit their measured frame.');
  return {basis:hangingBasis(b),confirmed:h.confirmed,points};
}
export function hangingStatus(p){
  const h=p.hanging;
  if(!h?.points.length)return {ready:false,label:'Hanging points not measured'};
  const b=h.basis;
  const matches=near(b.w,p.w)&&near(b.h,p.h)&&b.rotation===p.rotation&&b.shape===p.shape;
  if(!matches||!h.confirmed||h.points.some(q=>q.x>p.w+1e-6||q.y>p.h+1e-6))return {ready:false,label:'Review hanging measurements'};
  return {ready:true,label:`${h.points.length} measured hanging ${h.points.length===1?'point':'points'}`};
}
export function reconcileHanging(old,next){
  const h=cloneHanging(next.hanging);
  if(h&&(!old||!near(old.w,next.w)||!near(old.h,next.h)||old.rotation!==next.rotation||old.shape!==next.shape))h.confirmed=false;
  return {...next,hanging:h};
}
export const viewPoint=(p,q,back=true)=>({x:back?q.x:p.w-q.x,y:q.y});
export function wallFasteners(p,wall){
  if(!hangingStatus(p).ready)return [];
  return p.hanging.points.map((q,i)=>{
    const x=p.x+p.w-q.x,supportY=p.y+q.y,y=supportY-q.rise;
    return {id:q.id,label:String.fromCharCode(65+i),x,y,right:wall.w-x,bottom:wall.h-y,supportY,kind:q.kind,rise:q.rise,outside:x<0||x>wall.w||y<0||y>wall.h};
  });
}
