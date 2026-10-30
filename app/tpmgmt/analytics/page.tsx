import Link from 'next/link';
import {redirect} from 'next/navigation';
import {Users,MousePointer,ShoppingCart,Wallet} from 'lucide-react';
import {getAdmin} from '../../../lib/auth';
import {getMetrics} from '../../../lib/metrics';
import {money} from '../../../lib/format';
import AdminNav from '../_nav';
import RevenueChart from '../revenue-chart';
export default async function Analytics({searchParams}:{searchParams:Promise<{days?:string}>}){
  const admin=await getAdmin();if(!admin)redirect('/tpmgmt/login');if(admin.role!=='ADMIN'&&!admin.viewStatistics)redirect('/tpmgmt/dashboard');
  const sp=await searchParams;const days=sp.days==='7'?7:sp.days==='90'?90:30;const m=await getMetrics(days);
  const kpis=[{label:'ვიზიტის სესიები',value:m.sessions,note:'უნიკალური სესიები',icon:Users},{label:'პროდუქტის ნახვები',value:m.productViews,note:m.cartAdds+' კალათაში დამატება',icon:MousePointer},
    {label:'საშუალო შეკვეთა',value:money(m.averageOrder),note:m.validOrders+' გაუუქმებელი შეკვეთა',icon:ShoppingCart},{label:'ჩაბარებული გაყიდვები',value:money(m.revenue),note:admin.viewCost?'მოგება: '+money(m.profit):'ჩაბარებული შეკვეთები',icon:Wallet}];
  return <main className="dash"><AdminNav active="analytics" admin={admin}/><section><div className="dashTop"><div><p>სამუშაო სივრცე / ანალიტიკა</p><h1>ანალიტიკა</h1><span className="adminSubtitle">რეალური ვიზიტები და გაყიდვები.</span></div><nav className="dateTabs">{[7,30,90].map(d=><Link key={d} className={days===d?'active':''} href={'/tpmgmt/analytics?days='+d}>{d} დღე</Link>)}</nav></div>
    <div className="kpis">{kpis.map((k,i)=><article key={k.label}><div className="kpiHead"><span>{k.label}</span><span className={'kpiIcon tone'+i}><k.icon size={20}/></span></div><b>{k.value}</b><small>{k.note}</small></article>)}</div>
    <article className="adminPanel ordersPanel"><div className="panelHeading"><h2>გაყიდვების დინამიკა</h2><small>შეკვეთის შექმნის თარიღით · UTC</small></div><RevenueChart daily={m.daily}/></article>
    <div className="dashGrid"><article className="adminPanel"><div className="panelHeading"><h2>გაყიდვადი პროდუქტები</h2><small>ჩაბარებული შეკვეთებიდან</small></div>{m.topProducts.length?m.topProducts.map((p,i)=><div className="topProductRow" key={p.id}><span className="rank">0{i+1}</span><span>{p.name}<small>{p.quantity} გაყიდული ერთეული</small></span><b>{money(p.total)}</b></div>):<p className="adminEmpty">ჩაბარებული გაყიდვები ჯერ არ არის.</p>}</article>
      <article className="adminPanel"><div className="panelHeading"><h2>ვიზიტების წყაროები</h2></div>{m.sources.map(s=><div className="sourceRow" key={s.name}><span>{s.name}</span><div><i style={{width:(s.count/Math.max(1,m.sessions)*100)+'%'}}/></div><b>{s.count}</b></div>)}{!m.sources.length&&<p className="adminEmpty">მონაცემები ჯერ არ არის.</p>}<div className="deviceStats"><span>მობილური <b>{m.devices.mobile}</b></span><span>დესკტოპი <b>{m.devices.desktop}</b></span></div></article></div>
    <article className="adminPanel ordersPanel"><div className="panelHeading"><h2>ვიზიტიდან კალათამდე</h2></div><div className="funnelSteps">{[{label:'ვიზიტის სესიები',count:m.sessions},{label:'პროდუქტის მნახველი სესიები',count:m.viewSessions},{label:'კალათაში დამატების სესიები',count:m.cartSessions}].map((x,i)=><div key={x.label}><span>0{i+1}</span><b>{x.count}</b><small>{x.label}</small><div><i style={{width:(x.count/Math.max(1,m.sessions)*100)+'%'}}/></div></div>)}</div><p className="panelNote">შეკვეთების სესიებთან კავშირი V6-ის სქემაში არ ინახება, ამიტომ შეკვეთების კონვერსიას ზუსტ funnel-ად არ ვაჩვენებთ. სესია ადამიანების უნიკალურ რაოდენობას არ ნიშნავს.</p></article>
  </section></main>;
}
