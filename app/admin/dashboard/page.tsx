import Link from 'next/link';
import {redirect} from 'next/navigation';
import {ShoppingBag,ShoppingCart,Wallet,Users,ArrowUpRight,Plus,Package,Activity,AlertTriangle,CheckCircle2,ImageOff,Layers} from 'lucide-react';
import {getAdmin} from '../../../lib/auth';
import {db} from '../../../lib/db';
import {getMetrics,orderLabels} from '../../../lib/metrics';
import {money} from '../../../lib/format';
import AdminNav from '../_nav';
import RevenueChart from '../revenue-chart';
export default async function Dashboard({searchParams}:{searchParams:Promise<{days?:string}>}){
  const admin=await getAdmin();if(!admin)redirect('/admin/login');const sp=await searchParams;const days=sp.days==='7'?7:sp.days==='90'?90:30;
  const [productCount,activeCount,lowProducts,orders,metrics,unpublishedCount,missingPhotosCount,outOfStockCount]=await Promise.all([
    db.product.count(),db.product.count({where:{status:'ACTIVE'}}),
    db.product.findMany({where:{status:'ACTIVE',stock:{lte:5}},select:{id:true,name:true,stock:true,imageUrl:true},orderBy:{stock:'asc'},take:6}),
    admin.manageOrders?db.order.findMany({orderBy:{createdAt:'desc'},take:6,include:{items:{select:{name:true,quantity:true}}}}):Promise.resolve([]),
    admin.viewStatistics?getMetrics(days):Promise.resolve(null),
    db.product.count({where:{status:{not:'ACTIVE'}}}),
    db.product.count({where:{imageUrl:''}}),
    db.product.count({where:{status:'ACTIVE',stock:{lte:0}}}),
  ]);
  const change=metrics&&metrics.previousRevenue>0?(metrics.revenue-metrics.previousRevenue)/metrics.previousRevenue*100:null;
  const kpis=metrics?[{label:'ჩაბარებული გაყიდვები',value:money(metrics.revenue),note:change!==null?(change>=0?'+':'')+change.toFixed(1)+'% წინა პერიოდთან':'წინა პერიოდში შედარება არ არის',icon:Wallet},
    {label:'შეკვეთები',value:metrics.validOrders,note:metrics.cancelled+' გაუქმებული',icon:ShoppingCart},
    {label:'ვიზიტის სესიები',value:metrics.sessions,note:'საიტის რეალური აქტივობა',icon:Users},
    {label:'პროდუქტები',value:productCount,note:activeCount+' აქტიური',icon:ShoppingBag}]:
    [{label:'პროდუქტები',value:productCount,note:'მთლიანი კატალოგი',icon:ShoppingBag},{label:'აქტიური პროდუქტები',value:activeCount,note:'საჯარო კოლექცია',icon:Package}];
  return <main className="dash"><AdminNav active="dashboard" admin={admin}/><section><div className="dashTop"><div><p>სამუშაო სივრცე / მთავარი</p><h1>მთავარი პანელი</h1><span className="adminSubtitle">ყველაფერი შენი მაღაზიის შესახებ.</span></div><Link className="adminPrimary" href="/admin/products"><Plus size={16}/>პროდუქტის დამატება</Link></div>
    <div className="kpis">{kpis.map((k,i)=><article key={k.label}><div className="kpiHead"><span>{k.label}</span><span className={'kpiIcon tone'+i}><k.icon size={20}/></span></div><b>{k.value}</b><small>{k.note}</small></article>)}</div>
    <article className="adminPanel launchPanel"><div className="panelHeading"><div><h2><CheckCircle2 size={18}/>კატალოგის მზადყოფნა</h2><small>მონაცემები პირდაპირ პროდუქტის ბაზიდან · გამოქვეყნებამდე გადაამოწმე</small></div><Link href="/admin/products">პროდუქტების მართვა <ArrowUpRight size={15}/></Link></div><div className="launchStats"><div><Package size={19}/><strong>{productCount}</strong><span>სულ მოდელი</span></div><div><CheckCircle2 size={19}/><strong>{activeCount}</strong><span>აქტიური</span></div><div><Layers size={19}/><strong>{unpublishedCount}</strong><span>არააქტიური</span></div><div className={missingPhotosCount?'launchWarning':''}><ImageOff size={19}/><strong>{missingPhotosCount}</strong><span>ფოტოს გარეშე</span></div><div className={outOfStockCount?'launchWarning':''}><AlertTriangle size={19}/><strong>{outOfStockCount}</strong><span>ამოწურული აქტიური</span></div></div><p className="launchHint">50 მოდელის დამატებისას თითოეულს გადაამოწმე: დასახელება, SKU, ფასი, ფოტო, ზომები, მარაგი და გამოქვეყნების სტატუსი. ზომების მიხედვით დამოუკიდებელი მარაგი ჯერ არ აღირიცხება.</p></article>
    <div className="overviewGrid"><div className="welcomeCard"><span className="eyebrow">TOPURIA STUDIO</span><h2>გამარჯობა,<br/>{admin.name.split(' ')[0]}.</h2><p>ახალი კოლექცია იწყება აქ.</p><div className="welcomeMonogram" aria-hidden="true">T</div><Link href="/admin/products">კატალოგის მართვა <ArrowUpRight size={16}/></Link></div>
      {metrics&&<article className="adminPanel revenuePanel"><div className="panelHeading"><div><h2>გაყიდვების მიმოხილვა</h2><small>შეკვეთის შექმნის თარიღით · UTC</small></div><nav className="dateTabs" aria-label="გრაფიკის პერიოდი">{[7,30,90].map(d=><Link key={d} className={days===d?'active':''} href={'/admin/dashboard?days='+d}>{d} დღე</Link>)}</nav></div><RevenueChart daily={metrics.daily}/></article>}
    </div>
    <div className="dashGrid"><article className="adminPanel"><div className="panelHeading"><h2><Package size={17}/>მარაგის ყურადღება</h2><Link href="/admin/products">კატალოგი <ArrowUpRight size={15}/></Link></div>{lowProducts.length?lowProducts.map(p=><div className="inventoryRow" key={p.id}>{p.imageUrl?<img src={p.imageUrl} alt=""/>:<span className="inventoryPlaceholder">TP</span>}<span>{p.name}</span><b className={p.stock===0?'danger':'warning'}>{p.stock===0?'ამოწურულია':p.stock+' ც.'}</b></div>):<p className="adminEmpty">დაბალი მარაგის პროდუქტები არ არის.</p>}</article>
      {metrics&&<article className="adminPanel"><div className="panelHeading"><h2><Activity size={17}/>ვიზიტების წყაროები</h2><Link href="/admin/analytics">ანალიტიკა <ArrowUpRight size={15}/></Link></div>{metrics.sources.length?metrics.sources.slice(0,5).map(s=><div className="sourceRow" key={s.name}><span>{s.name}</span><div><i style={{width:(s.count/Math.max(1,metrics.sessions)*100)+'%'}}/></div><b>{s.count}</b></div>):<p className="adminEmpty">რეალური ვიზიტების მონაცემები აქ გამოჩნდება.</p>}<small className="panelNote">თითოეული წყაროს უნიკალური სესიები</small></article>}
    </div>
    {admin.manageOrders&&<article className="adminPanel ordersPanel"><div className="panelHeading"><h2>ბოლო შეკვეთები</h2><Link href="/admin/orders">ყველა შეკვეთა <ArrowUpRight size={15}/></Link></div><div className="adminTableScroll"><table className="overviewTable"><thead><tr><th>შეკვეთა</th><th>მომხმარებელი</th><th>პროდუქტი</th><th>თანხა</th><th>თარიღი</th><th>სტატუსი</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><Link href="/admin/orders">{o.orderNo}</Link></td><td>{o.customerName}</td><td>{o.items.map(i=>i.name+' ×'+i.quantity).join(', ')}</td><td>{money(o.total)}</td><td>{new Intl.DateTimeFormat('ka-GE',{day:'numeric',month:'short',timeZone:'Asia/Tbilisi'}).format(o.createdAt)}</td><td><span className={'statusBadge '+o.status.toLowerCase()}>{orderLabels[o.status]||o.status}</span></td></tr>)}</tbody></table></div>{!orders.length&&<p className="adminEmpty">შეკვეთები ჯერ არ არის.</p>}</article>}
    <div className="adminFootnote"><span>TOPURIA PREMIUM · V7</span><span>მონაცემები არსებული ბაზიდან</span></div>
  </section></main>;
}
