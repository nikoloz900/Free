'use client';
import {useState} from 'react';
import {money} from '../../lib/format';
type Day={date:string;label:string;revenue:number;orders:number};
export default function RevenueChart({daily}:{daily:Day[]}){
  const [mode,setMode]=useState<'revenue'|'orders'>('revenue'),[selected,setSelected]=useState<number|null>(null);
  const max=Math.max(1,...daily.map(d=>d[mode]));const total=daily.reduce((s,d)=>s+d[mode],0);
  const height=180,width=720,step=width/Math.max(1,daily.length-1);
  const points=daily.map((d,i)=>[i*step,height-d[mode]/max*(height-24)] as const);
  const path=points.map(([x,y],i)=>(i?'L':'M')+x+','+y).join(' ');
  return <div className="revenueChart"><div className="chartControls"><div><b>{mode==='revenue'?money(total):total}</b><small>{mode==='revenue'?'ჩაბარებული შეკვეთების ღირებულება':'გაუუქმებელი შეკვეთები'}</small></div><div className="segmented"><button className={mode==='revenue'?'active':''} onClick={()=>{setMode('revenue');setSelected(null)}}>შემოსავალი</button><button className={mode==='orders'?'active':''} onClick={()=>{setMode('orders');setSelected(null)}}>შეკვეთები</button></div></div>
    <div className="chartBody"><div className="chartAxis"><span>{mode==='revenue'?money(max):max}</span><span>{mode==='revenue'?money(max/2):Math.round(max/2)}</span><span>0</span></div><div className="chartPlot">
    <svg viewBox={'0 0 '+width+' '+(height+5)} role="img" aria-label={mode==='revenue'?'დღიური შემოსავლის გრაფიკი':'დღიური შეკვეთების გრაფიკი'} preserveAspectRatio="none">
      <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8d92ef" stopOpacity=".25"/><stop offset="100%" stopColor="#8d92ef" stopOpacity="0"/></linearGradient></defs>
      {[0,0.5,1].map(v=><line key={v} x1="0" y1={height*v} x2={width} y2={height*v} className="chartGrid"/>)}
      <path d={path+' L'+width+','+height+' L0,'+height+' Z'} fill="url(#revenueFill)"/><path d={path} fill="none" stroke="#8d92ef" strokeWidth="3" vectorEffect="non-scaling-stroke"/>
      {selected!==null&&<circle cx={points[selected][0]} cy={points[selected][1]} r="5" fill="#8d92ef"/>}
    </svg><div className="chartHits">{daily.map((d,i)=><button aria-label={d.label+': '+(mode==='revenue'?money(d.revenue):d.orders+' შეკვეთა')} key={d.date} onFocus={()=>setSelected(i)} onMouseEnter={()=>setSelected(i)} onClick={()=>setSelected(i)}/>)}</div></div></div>
    <div className="chartDates"><span>{daily[0]?.label}</span><span>{daily[Math.floor(daily.length/2)]?.label}</span><span>{daily.at(-1)?.label}</span></div>
    <p className="chartCaption" aria-live="polite">{selected!==null?daily[selected].label+' · '+(mode==='revenue'?money(daily[selected].revenue):daily[selected].orders+' შეკვეთა'):total===0?'ამ პერიოდში მონაცემები ჯერ არ არის.':'აირჩიეთ დღე დეტალების სანახავად.'}</p>
    <details className="chartData"><summary>მონაცემების ცხრილი</summary><table><thead><tr><th>თარიღი</th><th>შემოსავალი</th><th>შეკვეთები</th></tr></thead><tbody>{daily.map(d=><tr key={d.date}><td>{d.label}</td><td>{money(d.revenue)}</td><td>{d.orders}</td></tr>)}</tbody></table></details>
  </div>;
}
