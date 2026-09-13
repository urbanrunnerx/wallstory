import {validateHanging} from './hanging.js';
// All geometry is in inches. Visual scale never changes these dimensions.
export const EPS = 1e-6;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function bounds(items) {
  if (!items.length) return {x:0,y:0,w:0,h:0};
  const x=Math.min(...items.map(p=>p.x)),y=Math.min(...items.map(p=>p.y));
  return {x,y,w:Math.max(...items.map(p=>p.x+p.w))-x,h:Math.max(...items.map(p=>p.y+p.h))-y};
}
export function collide(a,b,gap=0) {
  return a.x < b.x+b.w+gap-EPS && a.x+a.w+gap > b.x+EPS && a.y < b.y+b.h+gap-EPS && a.y+a.h+gap > b.y+EPS;
}
export function issues(s) {
  const outside=[],overlap=[],spacing=[],margin=[];
  for(let i=0;i<s.items.length;i++) {
    const a=s.items[i];
    if(a.x < -EPS || a.y < -EPS || a.x+a.w > s.wall.w+EPS || a.y+a.h > s.wall.h+EPS) outside.push(a.id);
    else if(a.x<s.margin-EPS || a.y<s.margin-EPS || a.x+a.w>s.wall.w-s.margin+EPS || a.y+a.h>s.wall.h-s.margin+EPS) margin.push(a.id);
    for(let j=0;j<i;j++) {
      if(collide(a,s.items[j])) overlap.push([a.id,s.items[j].id]);
      else if(collide(a,s.items[j],s.gap)) spacing.push([a.id,s.items[j].id]);
    }
  }
  return {outside,overlap,spacing,margin};
}
function center(items,s) {
  const b=bounds(items),availW=s.wall.w-2*s.margin,availH=s.wall.h-2*s.margin;
  if(b.w>availW+EPS || b.h>availH+EPS) return null;
  const x=(s.wall.w-b.w)/2,y=clamp(s.wall.h-s.center-b.h/2,s.margin,s.wall.h-s.margin-b.h);
  return items.map(p=>({...p,x:p.x-b.x+x,y:p.y-b.y+y}));
}
function row(items,s,stair=false) {
  let x=0;const step=stair?Math.max(...items.map(p=>p.h))*.35:0;
  return center(items.map((p,i)=>{const r={...p,x,y:-p.h/2-i*step};x+=p.w+s.gap;return r}),s);
}
function grid(items,s) {
  const mw=Math.max(...items.map(p=>p.w)),mh=Math.max(...items.map(p=>p.h));
  let best=null,score=Infinity;
  for(let cols=1;cols<=items.length;cols++) {
    const rows=Math.ceil(items.length/cols),w=cols*mw+(cols-1)*s.gap,h=rows*mh+(rows-1)*s.gap;
    if(w>s.wall.w-2*s.margin+EPS || h>s.wall.h-2*s.margin+EPS) continue;
    const candidate=items.map((p,i)=>{const r=Math.floor(i/cols),c=i%cols,count=Math.min(cols,items.length-r*cols);return {...p,x:c*(mw+s.gap)+(cols-count)*(mw+s.gap)/2+(mw-p.w)/2,y:r*(mh+s.gap)+(mh-p.h)/2}});
    const v=Math.abs(Math.log(w/h/1.35))+(cols*rows-items.length)*.05;
    if(v<score) {score=v;best=center(candidate,s)}
  }
  return best;
}
function pack(items,s,variant,salon) {
  const aw=s.wall.w-2*s.margin,ah=s.wall.h-2*s.margin;
  let order=items.map(p=>({...p})).sort((a,b)=>b.w*b.h-a.w*a.h);
  if(variant>0) {
    const head=order.slice(0,1),tail=order.slice(1);
    // Stable permutations create alternatives without changing item identity.
    for(let i=tail.length-1;i>0;i--) {const j=((variant*31+i*17)%(i+1));[tail[i],tail[j]]=[tail[j],tail[i]]}
    order=[...head,...tail];
  }
  const placed=[{...order[0],x:-order[0].w/2,y:-order[0].h/2}];
  for(const p of order.slice(1)) {
    let best=null,score=Infinity;
    for(const q of placed) {
      const ys=[q.y,q.y+q.h-p.h,q.y+(q.h-p.h)/2];
      const xs=[q.x,q.x+q.w-p.w,q.x+(q.w-p.w)/2];
      const candidates=[...ys.flatMap(y=>[{x:q.x-p.w-s.gap,y},{x:q.x+q.w+s.gap,y}]),...xs.flatMap(x=>[{x,y:q.y-p.h-s.gap},{x,y:q.y+q.h+s.gap}])];
      for(const c of candidates) {
        const r={...p,...c};
        if(placed.some(t=>collide(r,t,s.gap)))continue;
        const b=bounds([...placed,r]);if(b.w>aw+EPS||b.h>ah+EPS)continue;
        const ratio=salon?1.1:1.45;
        const area=b.w*b.h,dist=(r.x+r.w/2)**2+(r.y+r.h/2)**2;
        const v=area*(1+Math.abs(Math.log(b.w/b.h/ratio))*.4)+dist*.18+(variant%3===1?Math.abs(r.y)*.05:Math.abs(r.x)*.05);
        if(v<score) {score=v;best=r}
      }
    }
    if(!best)return null;
    placed.push(best);
  }
  const result=center(placed,s);
  return result?.sort((a,b)=>items.findIndex(p=>p.id===a.id)-items.findIndex(p=>p.id===b.id));
}
function balanced(items,s) {
  const sorted=[...items].sort((a,b)=>b.w*b.h-a.w*a.h),anchor=sorted.shift();
  const sides=[[],[]],heights=[0,0];
  sorted.forEach(p=>{const side=heights[0]<=heights[1]?0:1;sides[side].push(p);heights[side]+=p.h+(sides[side].length>1?s.gap:0)});
  const result=[{...anchor,x:-anchor.w/2,y:-anchor.h/2}];
  sides.forEach((pieces,side)=>{const width=Math.max(0,...pieces.map(p=>p.w));let y=-heights[side]/2;pieces.forEach(p=>{result.push({...p,x:side===0?-anchor.w/2-s.gap-width+(width-p.w)/2:anchor.w/2+s.gap+(width-p.w)/2,y});y+=p.h+s.gap})});
  return center(result,s)?.sort((a,b)=>items.findIndex(p=>p.id===a.id)-items.findIndex(p=>p.id===b.id));
}
export function arrange(s,style=s.style,variation=0) {
  if(!s.items.length)return {ok:false,message:'Add at least one piece to arrange your wall.'};
  const aw=s.wall.w-2*s.margin,ah=s.wall.h-2*s.margin;
  if(aw<=0||ah<=0)return {ok:false,message:'The edge distance leaves no room. Reduce it or increase your wall measurements.'};
  if(s.items.some(p=>p.w>aw+EPS||p.h>ah+EPS))return {ok:false,message:'A piece is larger than the available wall area. Check its size, turn it, or reduce the edge distance.'};
  let result=null;
  if(style==='row'||style==='stair')result=row(s.items,s,style==='stair');
  else if(style==='grid')result=grid(s.items,s);
  else if(style==='balanced'&&(result=balanced(s.items,s))) { /* Center an anchor between balanced side columns. */ }
  else {
    let bestScore=Infinity;
    for(let n=0;n<12;n++) {
      const r=pack(s.items,s,variation*12+n,style==='salon');
      if(r) {const b=bounds(r),v=b.w*b.h*(1+Math.abs(Math.log(b.w/b.h/(style==='salon'?1.1:1.45)))*.35);if(v<bestScore){bestScore=v;result=r}}
    }
    if(!result)result=grid(s.items,s);
  }
  if(!result)return {ok:false,message:'No fitting arrangement found for this style. Try Balanced, smaller gaps, or fewer pieces. Your sizes have not changed.'};
  const check=issues({...s,items:result});
  if(check.outside.length||check.overlap.length||check.spacing.length||check.margin.length)return {ok:false,message:'This arrangement needs more room. Try a smaller gap or a different style.'};
  return {ok:true,items:result};
}
export function validCorners(p) {
  if(!Array.isArray(p)||p.length!==4||p.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)||v.x<0||v.y<0||v.x>1||v.y>1))return false;
  for(let i=0;i<4;i++) {const a=p[i],b=p[(i+1)%4],c=p[(i+2)%4];if((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x)<.003)return false}
  const area=Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%4];return sum+a.x*b.y-a.y*b.x},0))/2;
  return area>.025;
}
// Project a measured wall rectangle into the selected quadrilateral in a photo.
export function homography(p) {
  const [a,b,c,d]=p,dx1=b.x-c.x,dx2=d.x-c.x,dy1=b.y-c.y,dy2=d.y-c.y,dx3=a.x-b.x+c.x-d.x,dy3=a.y-b.y+c.y-d.y;
  const det=dx1*dy2-dx2*dy1;
  let g=0,h=0;
  if(Math.abs(det)>1e-12){g=(dx3*dy2-dx2*dy3)/det;h=(dx1*dy3-dx3*dy1)/det}
  const aa=b.x-a.x+g*b.x,bb=d.x-a.x+h*d.x,dd=b.y-a.y+g*b.y,ee=d.y-a.y+h*d.y;
  return (u,v)=>{const den=g*u+h*v+1;return {x:(aa*u+bb*v+a.x)/den,y:(dd*u+ee*v+a.y)/den}};
}
export function validateProject(v) {
  const finite=(n,a,b)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
  const image=(s)=>s===null||s===''||(typeof s==='string'&&s.length<9000000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s));
  if(v?.format!=='wallstory'||v.version!==1||!v.state)throw Error('This is not a supported Wallstory project.');
  const s=v.state;
  if(!s.wall||!finite(s.wall.w,12,1200)||!finite(s.wall.h,12,1200)||!finite(s.gap,0,24)||!finite(s.margin,0,Math.min(s.wall.w,s.wall.h)/2)||!finite(s.center,0,s.wall.h))throw Error('Some wall measurements are invalid.');
  if(!['in','cm'].includes(s.unit)||!['balanced','grid','salon','row','stair'].includes(s.style)||!Array.isArray(s.items)||s.items.length>40)throw Error('The project settings are invalid.');
  if(!image(s.photo)||!image(s.rawPhoto)||!validCorners(s.corners))throw Error('The wall photo data is invalid.');
  const ids=new Set();
  const items=s.items.map(p=>{
    if(!p||typeof p.id!=='string'||p.id.length>100||ids.has(p.id)||typeof p.name!=='string'||p.name.length>60||!['rectangle','square','circle','oval','arch','hexagon'].includes(p.shape)||!finite(p.w,.25,600)||!finite(p.h,.25,600)||!finite(p.x,-1200,1200)||!finite(p.y,-1200,1200)||![0,90,180,270].includes(p.rotation)||!/^#[0-9a-f]{6}$/i.test(p.color)||!image(p.image))throw Error('A piece contains invalid measurements or photo data.');
    if(['square','circle'].includes(p.shape)&&Math.abs(p.w-p.h)>EPS)throw Error('A circle or square must have equal width and height.');
    ids.add(p.id);return {id:p.id,name:p.name,shape:p.shape,w:p.w,h:p.h,x:p.x,y:p.y,rotation:p.rotation,color:p.color,image:p.image,hanging:validateHanging(p.hanging)};
  });
  return {wall:{w:s.wall.w,h:s.wall.h},gap:s.gap,margin:s.margin,center:s.center,unit:s.unit,style:s.style,items,photo:s.photo,rawPhoto:s.rawPhoto,corners:s.corners.map(p=>({x:p.x,y:p.y}))};
}
