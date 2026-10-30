'use client';
import {useEffect,useState} from 'react';
import {adminRequest,adminJson} from '../../../lib/tpmgmt-client';
import type {AdminPaymentSummary} from '../../../lib/tpmgmt-payments';
import {money} from '../../../lib/format';

type Item={id:number;name:string;price:number;quantity:number;size:string|null;color:string|null};
type Order={id:number;orderNo:string;customerName:string;phone:string;email:string|null;address:string|null;source:string;total:number;status:string;createdAt:string;items:Item[];payment:AdminPaymentSummary|null};
const labels:Record<string,string>={NEW:'ახალი',AWAITING_PAYMENT:'გადახდის მოლოდინში',PAYMENT_REVIEW:'გადახდა შესამოწმებელია',PAYMENT_TEST:'სატესტო შეკვეთა',CONFIRMED:'დადასტურებული',PREPARING:'მზადდება',SHIPPED:'გაგზავნილი',DELIVERED:'ჩაბარებული',CANCELLED:'გაუქმებული'};
const paymentLabels:Record<string,string>={CREATING:'ბანკთან კავშირი მზადდება',PENDING:'გადახდის მოლოდინში',PAID:'გადახდილია',FAILED:'გადახდა ვერ შესრულდა',EXPIRED:'გადახდის ვადა ამოიწურა',REVIEW:'გადახდა შესამოწმებელია'};
const methodLabels:Record<string,string>={card:'Visa / Mastercard',apple_pay:'Apple Pay',bnpl:'ნაწილ-ნაწილ',bog_loan:'BOG განვადება'};
const legacyStatuses=['NEW','CONFIRMED','PREPARING','SHIPPED','DELIVERED','CANCELLED'];
const fulfillmentStatuses=['CONFIRMED','PREPARING','SHIPPED','DELIVERED'];
const dateTime=(value:string|null)=>value?new Intl.DateTimeFormat('ka-GE',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Tbilisi'}).format(new Date(value)):'ჯერ არ არის';
const paymentAmount=(payment:AdminPaymentSummary)=>new Intl.NumberFormat('ka-GE',{style:'currency',currency:payment.currency}).format(payment.amountMinor/100);

function canFulfill(order:Order){return !order.payment||(order.payment.status==='PAID'&&order.payment.environment==='production'&&!order.payment.stockReleased)}
function statusOptions(order:Order){
 const options=order.payment?fulfillmentStatuses:legacyStatuses;
 return options.includes(order.status)?options:[order.status,...options];
}

export default function OrdersClient({initial}:{initial:Order[]}){
 const [orders,setOrders]=useState(initial),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState<number|null>(null),[search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[editing,setEditing]=useState<number|null>(null);
 const [form,setForm]=useState({customerName:'',phone:'',email:'',address:''});
 useEffect(()=>setOrders(initial),[initial]);

 async function change(id:number,data:Record<string,unknown>){
  setBusy(id);setError('');setSuccess('');
  try{
   const result=await adminRequest<Partial<Order>>('/api/admin/orders',adminJson('PATCH',{id,...data}));
   setOrders(list=>list.map(order=>order.id===id?{...order,...result}:order));
   setSuccess('შეკვეთა განახლდა.');setEditing(null);
  }catch(e){setError((e as Error).message)}finally{setBusy(null)}
 }

 async function reconcile(order:Order){
  if(!order.payment)return;
  setBusy(order.id);setError('');setSuccess('');
  try{
   const result=await adminRequest<{payment:AdminPaymentSummary;order:{id:number;status:string}}>('/api/admin/payments/reconcile',adminJson('POST',{id:order.payment.id}));
   setOrders(list=>list.map(current=>current.id===order.id?{...current,status:result.order.status,payment:result.payment}:current));
   setSuccess('ბანკის პასუხი განახლდა: '+(paymentLabels[result.payment.status]||result.payment.status)+'.');
  }catch(e){setError((e as Error).message)}finally{setBusy(null)}
 }

 const shown=orders.filter(order=>(filter==='all'||order.status===filter)&&(order.orderNo+' '+order.customerName+' '+order.phone+' '+(order.payment?.providerOrderId||'')).toLowerCase().includes(search.toLowerCase()));
 return <>
  {error&&<p className="adminNotice error" role="alert">{error}</p>}
  {success&&<p className="adminNotice success" role="status">{success}</p>}
  <div className="v5Panel">
   <div className="adminListFilters">
    <input className="v5Search" aria-label="შეკვეთის ძებნა" placeholder="შეკვეთა, სახელი ან ტელეფონი..." value={search} onChange={e=>setSearch(e.target.value)}/>
    <select aria-label="შეკვეთების სტატუსი" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">ყველა სტატუსი</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
   </div>
   {shown.map(order=><details className="orderManagement" key={order.id}>
    <summary>
     <span><b>{order.orderNo}</b><small>{order.customerName} · {order.phone}</small>{order.payment&&<small>{order.payment.environment==='sandbox'?'TEST · ':''}{paymentLabels[order.payment.status]||order.payment.status} · {methodLabels[order.payment.method]||order.payment.method}</small>}</span>
     <span className={'statusBadge '+order.status.toLowerCase()}>{labels[order.status]||order.status}</span><b>{money(order.total)}</b>
    </summary>
    <div className="orderDetails">
     <div className="orderInfo">
      <p><b>მომხმარებელი</b>{order.customerName}</p><p><b>ტელეფონი</b><a href={'tel:'+order.phone}>{order.phone}</a></p><p><b>ელფოსტა</b>{order.email||'არ არის მითითებული'}</p><p><b>მისამართი</b>{order.address||'არ არის მითითებული'}</p><p><b>წყარო</b>{order.source}</p><p><b>თარიღი</b>{new Date(order.createdAt).toISOString().slice(0,10)}</p>
     </div>
     <div className="orderItems">{order.items.map(item=><div key={item.id}><span>{item.name}<small>{[item.size,item.color].filter(Boolean).join(' · ')}</small></span><span>{item.quantity} × {money(item.price)}</span><b>{money(item.price*item.quantity)}</b></div>)}</div>
     <div className="panelHeading"><h2>გადახდა</h2>{order.payment?.environment==='sandbox'&&<span className="statusBadge">TEST · სატესტო გადახდა</span>}</div>
     {order.payment?<>
      <div className="orderInfo">
       <p><b>გადახდის სტატუსი</b>{paymentLabels[order.payment.status]||order.payment.status}</p>
       <p><b>გადახდის მეთოდი</b>{methodLabels[order.payment.method]||order.payment.method}</p>
       <p><b>ბანკში გადასახდელი</b>{paymentAmount(order.payment)}</p>
       <p><b>მაღაზიის ნომერი</b>{order.orderNo}</p>
       <p><b>BOG გადახდის ნომერი</b>{order.payment.providerOrderId||'ბანკს ჯერ არ შეუქმნია'}</p>
       <p><b>მარაგი</b>{order.payment.stockReleased?'ჯავშანი მოხსნილია':'შეკვეთისთვის გამოყოფილია'}</p>
       <p><b>გადახდის ვადა</b>{dateTime(order.payment.expiresAt)}</p>
       <p><b>გადახდის დადასტურება</b>{dateTime(order.payment.paidAt)}</p>
       <p><b>ბოლო გადამოწმება</b>{dateTime(order.payment.lastCheckedAt)}</p>
       {order.payment.rawStatus&&<p><b>ბანკის სტატუსი</b>{order.payment.rawStatus}</p>}
      </div>
      <div className="adminListFilters"><button type="button" className="adminSecondary" disabled={busy!==null} onClick={()=>void reconcile(order)}>{busy===order.id?'მოწმდება...':'ბანკთან გადამოწმება'}</button></div>
      {order.payment.environment==='sandbox'&&<p className="v5Hint">სატესტო შეკვეთა რეალურ გაყიდვად არ ითვლება და მიწოდებაში ვერ გადავა.</p>}
      {order.payment.status!=='PAID'&&<p className="v5Hint">მიწოდების მართვა გაიხსნება ბანკის მიერ რეალური გადახდის დადასტურების შემდეგ.</p>}
      <p className="v5Hint">ონლაინ შეკვეთის გაუქმება და თანხის დაბრუნება ბანკთან დასადასტურებელია.</p>
     </>:<p className="v5Hint">გადახდის მონაცემი არ არის — ძველი შეკვეთა.</p>}
     <div className="adminListFilters">
      <label>მიწოდების სტატუსი<select aria-label={order.orderNo+' სტატუსი'} disabled={busy!==null||!canFulfill(order)} value={order.status} onChange={e=>void change(order.id,{status:e.target.value})}>{statusOptions(order).map(status=><option key={status} value={status} disabled={!!order.payment&&!fulfillmentStatuses.includes(status)}>{labels[status]||status}</option>)}</select></label>
      <button disabled={busy!==null} onClick={()=>{setEditing(order.id);setForm({customerName:order.customerName,phone:order.phone,email:order.email||'',address:order.address||''})}} className="adminSecondary">მომხმარებლის მონაცემების რედაქტირება</button>
     </div>
     {editing===order.id&&<form onSubmit={e=>{e.preventDefault();void change(order.id,form)}}>
      <div className="v5Fields"><label>მომხმარებლის სახელი<input required value={form.customerName} onChange={e=>setForm({...form,customerName:e.target.value})}/></label><label>ტელეფონი<input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label>ელფოსტა<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label></div>
      <label className="v5Full">მიწოდების მისამართი<textarea value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
      <div className="v5FormActions"><button disabled={busy!==null} className="v5Primary">{busy===order.id?'ინახება...':'ცვლილებების შენახვა'}</button><button type="button" onClick={()=>setEditing(null)}>გაუქმება</button></div>
     </form>}
    </div>
   </details>)}
   {!shown.length&&<p className="adminEmpty">შეკვეთები ვერ მოიძებნა.</p>}
  </div>
 </>;
}
