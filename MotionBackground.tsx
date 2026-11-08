import {useEffect,useRef} from 'react';

/** Purely decorative motion: no state updates or canvas work in the render loop. */
export default function MotionBackground({enabled}:{enabled:boolean}){
 const layer=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!enabled||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  let frame=0;
  const move=(event:PointerEvent)=>{
   if(event.pointerType==='touch')return;
   cancelAnimationFrame(frame);
   const x=(event.clientX/innerWidth-.5)*22,y=(event.clientY/innerHeight-.5)*22;
   frame=requestAnimationFrame(()=>{layer.current?.style.setProperty('--pointer-x',`${x}px`);layer.current?.style.setProperty('--pointer-y',`${y}px`);});
  };
  window.addEventListener('pointermove',move,{passive:true});
  return()=>{window.removeEventListener('pointermove',move);cancelAnimationFrame(frame);};
 },[enabled]);
 return <div ref={layer} className="ambient-scene" aria-hidden="true">
  <div className="ambient-grid"><svg width="100%" height="100%"><defs><pattern id="motion-grid" width="96" height="96" patternUnits="userSpaceOnUse"><path d="M 96 0 L 0 0 0 96" fill="none" stroke="currentColor" strokeWidth=".45"/></pattern></defs><rect width="100%" height="100%" fill="url(#motion-grid)"/></svg></div>
  <div className="ambient-parallax">
   <svg className="orbital-system" viewBox="0 0 800 800" fill="none">
    <g className="orbit-outer"><circle cx="400" cy="400" r="338"/><circle cx="400" cy="62" r="5" className="orbit-bead"/><path d="M400 46v32M384 62h32"/></g>
    <g className="orbit-middle"><ellipse cx="400" cy="400" rx="282" ry="194" transform="rotate(-35 400 400)"/><ellipse cx="400" cy="400" rx="282" ry="194" transform="rotate(35 400 400)"/><circle cx="682" cy="400" r="7" className="orbit-bead"/></g>
    <g className="orbit-inner"><circle cx="400" cy="400" r="157" strokeDasharray="1 13" strokeLinecap="round" strokeWidth="2"/><path d="M388 243h24M400 231v24M388 557h24M400 545v24"/></g>
    <g className="orbit-core"><rect x="371" y="371" width="58" height="58" transform="rotate(45 400 400)"/><circle cx="400" cy="400" r="8" className="orbit-bead"/></g>
   </svg>
   <svg className="ambient-compass" viewBox="0 0 300 300" fill="none"><circle cx="150" cy="150" r="125"/><circle cx="150" cy="150" r="102" strokeDasharray="2 11"/><path d="M150 0v300M0 150h300M44 44l212 212M44 256 256 44"/><circle cx="150" cy="25" r="5" className="orbit-bead"/></svg>
  </div>
  <div className="ambient-trace trace-one"/><div className="ambient-trace trace-two"/>
  <div className="ambient-particles">{Array.from({length:12},(_,i)=><i key={i} style={{left:`${(i*37+9)%100}%`,top:`${(i*23+7)%100}%`,'--drift-duration':`${19+i*3}s`,'--drift-delay':`${-i*4}s`,'--drift-x':`${i%2?38:-32}px`} as React.CSSProperties}/>)}</div>
 </div>;
}
