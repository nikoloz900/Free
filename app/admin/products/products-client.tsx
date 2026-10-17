'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {Plus,Search,LayoutGrid,List,X,ImagePlus,Pencil,Package,Trash2} from 'lucide-react';
import {adminRequest,adminJson,toSlug} from '../../../lib/admin-client';
import {money} from '../../../lib/format';
import {prepareProductImage} from '../../../lib/product-image';
type Product={id:number;name:string;slug:string;sku:string;category:string;description:string;imageUrl:string;sizes:string;colors:string;price:number;salePrice:number|null;cost?:number;stock:number;status:string};
type Category={id:number;name:string;slug:string;active:boolean};
const empty={name:'',slug:'',sku:'',category:'',description:'',imageUrl:'',sizes:'',colors:'',price:'',salePrice:'',cost:'',stock:'0',status:'ACTIVE'};

const statusLabels:Record<string,string>={ACTIVE:'აქტიური',DRAFT:'დრაფტი',ARCHIVED:'არქივი'};
export default function ProductsClient({canDelete,canViewCost,canManageCategories}:{canDelete:boolean;canViewCost:boolean;canManageCategories:boolean}){
 const [items,setItems]=useState<Product[]>([]),[categories,setCategories]=useState<Category[]>([]),[form,setForm]=useState(empty);
 const [editing,setEditing]=useState<number|null>(null),[open,setOpen]=useState(false),[saving,setSaving]=useState(false),[loading,setLoading]=useState(true);
 const [error,setError]=useState(''),[editorError,setEditorError]=useState(''),[success,setSuccess]=useState(''),[query,setQuery]=useState(''),[filter,setFilter]=useState('ALL'),[view,setView]=useState<'list'|'grid'>('list'),[uploading,setUploading]=useState(false),[uploadStatus,setUploadStatus]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);const fileInput=useRef<HTMLInputElement>(null);const params=useSearchParams();
 const cloudinaryReady=Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME&&process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY);
 useEffect(()=>setQuery(params.get('q')||''),[params]);
 async function load(){
  const [products,cats]=await Promise.allSettled([adminRequest<Product[]>('/api/admin/products'),adminRequest<Category[]>('/api/admin/categories')]);
  if(products.status==='fulfilled')setItems(products.value);else setError(products.reason?.message||'პროდუქტები ვერ ჩაიტვირთა.');
  if(cats.status==='fulfilled')setCategories(cats.value);else setError('კატეგორიების ჩატვირთვა ვერ შესრულდა. არსებულ პროდუქტს მაინც შეგიძლიათ შეცვალოთ ფასი და მარაგი.');
  setLoading(false);
 }
 useEffect(()=>{void load()},[]);
 useEffect(()=>{if(!open)return;dialog.current?.showModal();const before=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{document.body.style.overflow=before}},[open]);
 function start(p?:Product){setEditorError('');setUploadStatus('');setEditing(p?.id??null);setForm(p?{name:p.name,slug:p.slug,sku:p.sku,category:p.category,description:p.description,imageUrl:p.imageUrl,sizes:p.sizes,colors:p.colors,price:String(p.price),salePrice:p.salePrice===null?'':String(p.salePrice),cost:String(p.cost||0),stock:String(p.stock),status:p.status}:{...empty,category:categories.find(c=>c.active)?.slug||''});setOpen(true)}
 function close(){if(saving||uploading)return;dialog.current?.close();setOpen(false)}
 async function upload(file:File){
  if(file.size>10000000||!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)){setEditorError('აირჩიეთ JPG, PNG, WEBP ან AVIF ფოტო, მაქსიმუმ 10MB.');return}
  setUploading(true);setEditorError('');setUploadStatus('ფოტო მცირდება...');
  try{
   const prepared=await prepareProductImage(file);setUploadStatus('ფოტო იტვირთება...');
   const timestamp=Math.floor(Date.now()/1000),folder='topuria-premium/products';
   const signed=await adminRequest<{signature:string}>('/api/admin/cloudinary-sign',adminJson('POST',{paramsToSign:{timestamp,folder}}));
   const data=new FormData();data.set('file',prepared.file);data.set('api_key',process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY!);data.set('timestamp',String(timestamp));data.set('folder',folder);data.set('signature',signed.signature);
   const r=await fetch('https://api.cloudinary.com/v1_1/'+encodeURIComponent(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!)+'/image/upload',{method:'POST',body:data});
   const result=await r.json();if(!r.ok||typeof result.secure_url!=='string'||!result.secure_url.startsWith('https://'))throw new Error('ფოტოს ატვირთვა ვერ შესრულდა. შეამოწმეთ Cloudinary-ის გასაღებების შესაბამისობა.');
   setForm(old=>({...old,imageUrl:result.secure_url}));setUploadStatus('ფოტო აიტვირთა ('+Math.round(prepared.file.size/1024)+' KB). ბოლოს დააჭირეთ „პროდუქტის შენახვას“.');
  }catch(e){setEditorError((e as Error).message);setUploadStatus('')}finally{setUploading(false);if(fileInput.current)fileInput.current.value=''}
 }
 async function save(e:React.FormEvent){
  e.preventDefault();setSaving(true);setEditorError('');
  try{const data={...form,id:editing,slug:form.slug||toSlug(form.name)+'-'+crypto.randomUUID().slice(0,8),sku:form.sku||'TP-'+crypto.randomUUID().slice(0,8).toUpperCase()};
   const product=await adminRequest<Product>('/api/admin/products',adminJson(editing?'PATCH':'POST',data));
   setItems(list=>editing?list.map(p=>p.id===product.id?product:p):[product,...list]);
   setSuccess(editing?'პროდუქტი განახლდა.':'პროდუქტი დაემატა.');setError('');dialog.current?.close();setOpen(false);
  }catch(e){setEditorError((e as Error).message)}finally{setSaving(false)}
 }
 async function remove(p:Product){
  if(!confirm('წავშალოთ „'+p.name+'“?'))return;
  try{await adminRequest('/api/admin/products?id='+p.id,{method:'DELETE'});setItems(list=>list.filter(item=>item.id!==p.id));setSuccess('პროდუქტი წაიშალა.');setError('')}
  catch(e){setError((e as Error).message)}
 }
 const shown=items.filter(p=>(filter==='ALL'||p.status===filter)&&(p.name+' '+p.sku+' '+p.category).toLowerCase().includes(query.toLowerCase()));
 const field=(key:keyof typeof empty,label:string,type='text',required=false)=><label>{label}<input type={type} required={required} min={type==='number'?0:undefined} step={type==='number'?1:undefined} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>;
 const categoryName=(p:Product)=>categories.find(c=>c.slug===p.category)?.name||p.category;
 return <>{error&&<p role="alert" className="adminNotice error">{error}</p>}{success&&<p role="status" className="adminNotice success">{success}</p>}
 <div className="productWorkspaceToolbar"><div className="productSearch"><Search size={17}/><input aria-label="პროდუქტის ძებნა" placeholder="მოძებნე პროდუქტი..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="productViewSwitch"><button aria-label="სიის ხედი" aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={17}/></button><button aria-label="ბარათების ხედი" aria-pressed={view==='grid'} onClick={()=>setView('grid')}><LayoutGrid size={17}/></button></div><button className="adminPrimary" onClick={()=>start()}><Plus size={17}/>პროდუქტის დამატება</button></div>
 <div className="productStatusTabs">{['ALL','ACTIVE','DRAFT','ARCHIVED'].map(status=><button key={status} aria-pressed={filter===status} onClick={()=>setFilter(status)}>{status==='ALL'?'ყველა':statusLabels[status]}<span>{items.filter(p=>status==='ALL'||p.status===status).length}</span></button>)}</div>
 {loading?<div className="v5Panel adminEmpty">პროდუქტები იტვირთება...</div>:shown.length?
 view==='grid'?<div className="adminProductGrid">{shown.map(p=><article key={p.id}><button className="adminProductImage" onClick={()=>start(p)} aria-label={p.name+' რედაქტირება'}>{p.imageUrl?<img src={p.imageUrl} alt={p.name}/>:<Package size={40}/>}<span className="editImageBadge"><Pencil size={15}/></span></button><div className="adminProductCardInfo"><small>{categoryName(p)}</small><button onClick={()=>start(p)}>{p.name}</button><div><b>{money(p.salePrice??p.price)}</b><span>{p.stock} ც.</span></div><span className={p.status==='ACTIVE'?'v5Pill':'v5Pill muted'}>{statusLabels[p.status]}</span></div></article>)}</div>:
 <div className="v5Panel productListPanel"><div className="adminTableScroll"><table className="productManagementTable"><thead><tr><th>პროდუქტი</th><th>კატეგორია</th><th>ფასი</th><th>მარაგი</th><th>სტატუსი</th><th>მოქმედება</th></tr></thead><tbody>{shown.map(p=><tr key={p.id}><td><button className="productIdentityButton" onClick={()=>start(p)}>{p.imageUrl?<img src={p.imageUrl} alt=""/>:<span className="inventoryPlaceholder">TP</span>}<span><b>{p.name}</b><small>{p.sku}</small></span></button></td><td>{categoryName(p)}</td><td><button className="inlineProductEdit" onClick={()=>start(p)} aria-label={p.name+' ფასის შეცვლა'}>{money(p.salePrice??p.price)}<Pencil size={12}/></button></td><td><button className={'inlineProductEdit '+(p.stock<=5?'warning':'')} onClick={()=>start(p)} aria-label={p.name+' მარაგის შეცვლა'}>{p.stock} ც.<Pencil size={12}/></button></td><td><span className={p.status==='ACTIVE'?'v5Pill':'v5Pill muted'}>{statusLabels[p.status]}</span></td><td><div className="v5RowActions"><button onClick={()=>start(p)}><Pencil size={12}/>რედაქტირება</button>{canDelete&&<button className="danger" aria-label={p.name+' წაშლა'} onClick={()=>void remove(p)}><Trash2 size={14}/></button>}</div></td></tr>)}</tbody></table></div></div>:
 <div className="v5Panel adminEmpty"><Package size={35}/><h2>{items.length?'პროდუქტი ვერ მოიძებნა':'დაამატე პირველი პროდუქტი'}</h2><p>{items.length?'შეცვალე ძებნა ან ფილტრი.':'ფოტო, ფასი და მარაგი — ერთ სივრცეში.'}</p><button className="adminPrimary" onClick={()=>start()}><Plus size={16}/>პროდუქტის დამატება</button></div>}
 {open&&<dialog ref={dialog} className="productEditorDialog" onCancel={e=>{if(saving||uploading)e.preventDefault();else setOpen(false)}} onClose={()=>setOpen(false)}>
 <form onSubmit={save}><header><div><span>TOPURIA PRODUCT STUDIO</span><h2>{editing?'პროდუქტის რედაქტირება':'ახალი პროდუქტი'}</h2></div><button type="button" disabled={saving||uploading} aria-label="რედაქტორის დახურვა" onClick={close}><X size={21}/></button></header>
 <div className="productEditorBody">{editorError&&<p role="alert" className="adminNotice error">{editorError}</p>}<fieldset disabled={saving||uploading}><div className="productEditorGrid">
 <div className="productPhotoEditor">{form.imageUrl?<img src={form.imageUrl} alt="პროდუქტის ფოტო"/>:<div className="photoEmpty"><ImagePlus size={42}/><span>დაამატე პროდუქტის ფოტო</span></div>}
 <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif" aria-label="პროდუქტის ფოტოს ატვირთვა" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file)}}/>
 {cloudinaryReady?<button type="button" disabled={uploading} className="adminPrimary" onClick={()=>fileInput.current?.click()}><ImagePlus size={16}/>{uploading?'ფოტო იტვირთება...':form.imageUrl?'ფოტოს შეცვლა':'ფოტოს ატვირთვა'}</button>:<p className="v5Hint">ფოტოს ატვირთვა არ არის კონფიგურირებული. შეგიძლიათ ფოტოს ბმული მიუთითოთ.</p>}
 {uploadStatus&&<p className="v5Hint" role="status">{uploadStatus}</p>}
 {form.imageUrl&&<button type="button" className="adminSecondary" onClick={()=>setForm({...form,imageUrl:''})}>ფოტოს მოხსნა</button>}<details><summary>ფოტოს ბმული</summary>{field('imageUrl','ფოტოს HTTPS ბმული')}</details></div>
 <div className="productFields"><div className="v5Fields">{field('name','დასახელება','text',true)}<label>კატეგორია<select required value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option value="">აირჩიე კატეგორია</option>{form.category&&!categories.some(c=>c.slug===form.category)&&<option value={form.category}>{form.category}</option>}{categories.filter(c=>c.active||c.slug===form.category).map(c=><option key={c.id} value={c.slug}>{c.name}</option>)}</select></label>{field('price','ფასი ₾','number',true)}{field('salePrice','ფასდაკლებული ფასი ₾','number')}{field('stock','მარაგი','number',true)}<label>სტატუსი<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>{field('sizes','ზომები — მაგ. S,M,L')}{field('colors','ფერები — მაგ. ბორდო,შავი')}{canViewCost&&field('cost','თვითღირებულება ₾','number')}</div>
 {!categories.length&&<p className="v5Hint">{canManageCategories?<Link href="/admin/categories">ჯერ დაამატეთ კატეგორია →</Link>:'ახალი პროდუქტის კატეგორიის დასამატებლად მიმართეთ მფლობელს.'}</p>}
 <label className="v5Full">აღწერა<textarea rows={4} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
 <details className="adminAdvanced"><summary>პროდუქტის მისამართი და კოდი</summary><div className="v5Fields">{field('slug','მისამართი — ავტომატურად იქმნება')}{field('sku','კოდი — ავტომატურად იქმნება')}</div></details></div>
 </div></fieldset></div><footer><button type="button" className="adminSecondary" disabled={saving||uploading} onClick={close}>გაუქმება</button><button className="adminPrimary" disabled={saving||uploading}>{saving?'ინახება...':'პროდუქტის შენახვა'}</button></footer></form></dialog>}
 </>;
}
