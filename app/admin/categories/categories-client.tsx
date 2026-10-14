'use client';
import {useEffect,useState} from 'react';
import {adminRequest,adminJson,toSlug} from '../../../lib/admin-client';
type Cat={id:number;name:string;slug:string;description:string;active:boolean;sortOrder:number};
const empty={name:'',slug:'',description:'',sortOrder:0,active:true};
export default function CategoriesClient(){
 const [items,setItems]=useState<Cat[]>([]),[form,setForm]=useState(empty),[editing,setEditing]=useState<number|null>(null),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 async function load(){try{setItems(await adminRequest<Cat[]>('/api/admin/categories'))}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setSuccess('');
  try{const data={...form,id:editing,slug:form.slug||toSlug(form.name)};
   await adminRequest('/api/admin/categories',adminJson(editing?'PATCH':'POST',data));setSuccess(editing?'კატეგორია განახლდა.':'კატეგორია დაემატა.');setEditing(null);setForm(empty);await load();
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 function edit(c:Cat){setEditing(c.id);setForm({name:c.name,slug:c.slug,description:c.description,active:c.active,sortOrder:c.sortOrder});setError('');setSuccess('');document.getElementById('category-editor')?.scrollIntoView({behavior:'smooth',block:'start'})}
 async function toggle(c:Cat){setBusy(true);setError('');try{await adminRequest('/api/admin/categories',adminJson('PATCH',{id:c.id,active:!c.active}));await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function remove(c:Cat){if(!confirm('წავშალოთ კატეგორია „'+c.name+'“?'))return;setBusy(true);setError('');try{await adminRequest('/api/admin/categories?id='+c.id,{method:'DELETE'});setSuccess('კატეგორია წაიშალა.');await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <>{error&&<p className="adminNotice error" role="alert">{error}</p>}{success&&<p className="adminNotice success" role="status">{success}</p>}
 <form id="category-editor" className="v5Panel" onSubmit={save}><div className="v5PanelHead"><h2>{editing?'კატეგორიის რედაქტირება':'ახალი კატეგორია'}</h2></div>
 <div className="v5Fields"><label>დასახელება<input required maxLength={200} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
 <label>რიგითობა<input type="number" min={0} max={100000} step={1} value={form.sortOrder} onChange={e=>setForm({...form,sortOrder:Number(e.target.value)})}/></label>
 <label>მისამართი<input readOnly={editing!==null} pattern="[a-z0-9-]+" value={form.slug} placeholder={toSlug(form.name||'კატეგორია')} onChange={e=>setForm({...form,slug:e.target.value.toLowerCase()})}/></label></div>
 <label className="v5Full">აღწერა<textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
 <label className="adminCheck"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/>აქტიური კატეგორია</label>
 <div className="v5FormActions"><button className="v5Primary" disabled={busy}>{busy?'ინახება...':editing?'ცვლილებების შენახვა':'კატეგორიის დამატება'}</button>{editing&&<button type="button" onClick={()=>{setEditing(null);setForm(empty)}}>გაუქმება</button>}</div></form>
 <div className="v5Panel"><div className="v5PanelHead"><h2>კატეგორიები</h2><span>{items.length} ჩანაწერი</span></div>{loading?<p>იტვირთება...</p>:items.length?items.map(c=><div className="categoryManagementRow" key={c.id}><div><strong>{c.name}</strong><small>/{c.slug} · რიგითობა {c.sortOrder}</small></div><span className={c.active?'v5Pill':'v5Pill muted'}>{c.active?'აქტიური':'დამალული'}</span><div className="v5RowActions"><button disabled={busy} onClick={()=>edit(c)}>რედაქტირება</button><button disabled={busy} onClick={()=>void toggle(c)}>{c.active?'დამალვა':'გამოჩენა'}</button><button disabled={busy} className="danger" onClick={()=>void remove(c)}>წაშლა</button></div></div>):<p className="adminEmpty">კატეგორიები ჯერ არ არის.</p>}</div></>;
}
