import {db} from './db';
export const orderLabels:Record<string,string>={NEW:'ახალი',CONFIRMED:'დადასტურებული',PREPARING:'მზადდება',SHIPPED:'გაგზავნილი',DELIVERED:'ჩაბარებული',CANCELLED:'გაუქმებული'};
export async function getMetrics(days:number){
  const today=new Date();today.setUTCHours(0,0,0,0);const since=new Date(today);since.setUTCDate(since.getUTCDate()-days+1);
  const until=new Date(today);until.setUTCDate(until.getUTCDate()+1);const previous=new Date(since);previous.setUTCDate(previous.getUTCDate()-days);
  const [orders,events]=await Promise.all([
    db.order.findMany({where:{createdAt:{gte:previous,lt:until}},include:{items:{select:{name:true,productId:true,quantity:true,cost:true,price:true}}},orderBy:{createdAt:'desc'}}),
    db.analyticsEvent.findMany({where:{createdAt:{gte:since,lt:until}},select:{type:true,sessionId:true,source:true,device:true,productSlug:true,createdAt:true}}),
  ]);
  const current=orders.filter(o=>o.createdAt>=since),prior=orders.filter(o=>o.createdAt<since);
  const valid=current.filter(o=>o.status!=='CANCELLED'),delivered=valid.filter(o=>o.status==='DELIVERED');
  const revenue=delivered.reduce((s,o)=>s+o.total,0),previousRevenue=prior.filter(o=>o.status==='DELIVERED').reduce((s,o)=>s+o.total,0);
  const sessions=new Set(events.map(e=>e.sessionId).filter(Boolean)).size;
  const productViews=events.filter(e=>e.type==='product_view').length,cartAdds=events.filter(e=>e.type==='add_to_cart').length;
  const sessionSet=(type:string)=>new Set(events.filter(e=>e.type===type).map(e=>e.sessionId).filter(Boolean)).size;
  const daily=Array.from({length:days},(_,i)=>{const date=new Date(since);date.setUTCDate(date.getUTCDate()+i);const key=date.toISOString().slice(0,10);
    const entries=valid.filter(o=>o.createdAt.toISOString().slice(0,10)===key);
    return {date:key,label:new Intl.DateTimeFormat('ka-GE',{day:'numeric',month:'short',timeZone:'UTC'}).format(date),
      revenue:entries.filter(o=>o.status==='DELIVERED').reduce((s,o)=>s+o.total,0),orders:entries.length};
  });
  const sourceMap=new Map<string,Set<string>>();
  for(const e of events)if(e.sessionId){const name=e.source||'Direct';if(!sourceMap.has(name))sourceMap.set(name,new Set());sourceMap.get(name)!.add(e.sessionId)}
  const sources=[...sourceMap].map(([name,ids])=>({name,count:ids.size})).sort((a,b)=>b.count-a.count);
  const sold=new Map<number,{id:number;name:string;quantity:number;total:number}>();
  for(const o of delivered)for(const item of o.items){const p=sold.get(item.productId)||{id:item.productId,name:item.name,quantity:0,total:0};p.quantity+=item.quantity;p.total+=item.price*item.quantity;sold.set(item.productId,p)}
  return {days,since,revenue,previousRevenue,profit:revenue-delivered.reduce((s,o)=>s+o.items.reduce((n,i)=>n+i.cost*i.quantity,0),0),
    sessions,productViews,cartAdds,viewSessions:sessionSet('product_view'),cartSessions:sessionSet('add_to_cart'),
    conversion:sessions?valid.length/sessions*100:0,averageOrder:valid.length?valid.reduce((s,o)=>s+o.total,0)/valid.length:0,
    validOrders:valid.length,cancelled:current.filter(o=>o.status==='CANCELLED').length,daily,sources,
    topProducts:[...sold.values()].sort((a,b)=>b.quantity-a.quantity).slice(0,5),
    devices:{mobile:new Set(events.filter(e=>e.device==='Mobile').map(e=>e.sessionId).filter(Boolean)).size,desktop:new Set(events.filter(e=>e.device==='Desktop').map(e=>e.sessionId).filter(Boolean)).size},
  };
}
