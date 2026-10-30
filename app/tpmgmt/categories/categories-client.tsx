'use client';
import {useEffect,useState} from 'react';
import {adminRequest,adminJson,toSlug} from '../../../lib/tpmgmt-client';
import {translateCategoryName} from '../../../lib/category-labels';
type Translations=Partial<Record<'ka'|'en'|'ru',string>>;
type Cat={id:number;name:string;slug:string;description:string;active:boolean;sortOrder:number;translations:Translations};
const empty={name:'',slug:'',description:'',sortOrder:0,active:true};
const languages=[{locale:'ka',label:'ქართული'},{locale:'en',label:'English'},{locale:'ru',label:'Русский'}] as const;
export default function CategoriesClient(){
 const [items,setItems]=useState<Cat[]>([]),[form,setForm]=useState(empty),[editing,setEditing]=useState<number|null>(null),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [translations,setTranslations]=useState<Translations>({}),[translationEdits,setTranslationEdits]=useState<Translations>({}),[translationsReady,setTranslationsReady]=useState(false);
 async function load(){try{const data=await adminRequest<{categories:Cat[];translationsReady:boolean}>('/api/admin/categories?translations=1');setItems(data.categories);setTranslationsReady(data.translationsReady)}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 function resetEditor(){setEditing(null);setForm(empty);setTranslations({});setTranslationEdits({})}
 function updateName(name:string){
  const oldName=form.name;
  setForm(previous=>({...previous,name}));
  const suggestions:Translations={};
  for(const locale of ['ka','en','ru'] as const){
   if(Object.prototype.hasOwnProperty.call(translationEdits,locale))continue;
   const current=translations[locale]?.trim()||'';
   const previousDefault=locale==='ka'?oldName.trim():translateCategoryName(oldName,locale);
   // On rename, replace only generated/unchanged values. Preserve custom translations.
   if(editing!==null&&current&&current!==previousDefault)continue;
   const translated=locale==='ka'?name.trim():translateCategoryName(name,locale);
   suggestions[locale]=name.trim()&&(locale==='ka'||translated!==name.trim())?translated:'';
  }
  setTranslations(previous=>({...previous,...suggestions}));
 }
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setSuccess('');
  try{const data={...form,id:editing,slug:form.slug||toSlug(form.name),...(translationsReady?{translations:{...translations,...translationEdits}}:{})};
   await adminRequest('/api/admin/categories',adminJson(editing?'PATCH':'POST',data));setSuccess(editing?'კატეგორია განახლდა.':'კატეგორია დაემატა.');resetEditor();await load();
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 function edit(c:Cat){setEditing(c.id);setForm({name:c.name,slug:c.slug,description:c.description,active:c.active,sortOrder:c.sortOrder});setTranslations(c.translations??{});setTranslationEdits({});setError('');setSuccess('');document.getElementById('category-editor')?.scrollIntoView({behavior:'smooth',block:'start'})}
 async function toggle(c:Cat){setBusy(true);setError('');try{await adminRequest('/api/admin/categories',adminJson('PATCH',{id:c.id,active:!c.active}));await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function remove(c:Cat){if(!confirm('წავშალოთ კატეგორია „'+c.name+'“?'))return;setBusy(true);setError('');try{await adminRequest('/api/admin/categories?id='+c.id,{method:'DELETE'});setSuccess('კატეგორია წაიშალა.');await load()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <>{error&&<p className="adminNotice error" role="alert">{error}</p>}{success&&<p className="adminNotice success" role="status">{success}</p>}
 <form id="category-editor" className="v5Panel" onSubmit={save}><div className="v5PanelHead"><h2>{editing?'კატეგორიის რედაქტირება':'ახალი კატეგორია'}</h2></div>
 <div className="v5Fields"><label>დასახელება<input required maxLength={200} value={form.name} onChange={e=>updateName(e.target.value)}/></label>
 <label>რიგითობა<input type="number" min={0} max={100000} step={1} value={form.sortOrder} onChange={e=>setForm({...form,sortOrder:Number(e.target.value)})}/></label>
 <label>მისამართი<input readOnly={editing!==null} pattern="[a-z0-9-]+" value={form.slug} placeholder={toSlug(form.name||'კატეგორია')} onChange={e=>setForm({...form,slug:e.target.value.toLowerCase()})}/></label></div>
 <fieldset className="categoryTranslations" disabled={!translationsReady||busy} aria-describedby="category-translations-help"><legend>დასახელებები ენების მიხედვით</legend>
 <div className="v5Fields">{languages.map(({locale,label})=><label key={locale}>{label}<input lang={locale} maxLength={200} value={translations[locale]??''} placeholder={translateCategoryName(form.name,locale)||label} onChange={e=>{setTranslations({...translations,[locale]:e.target.value});setTranslationEdits({...translationEdits,[locale]:e.target.value})}}/></label>)}</div>
 </fieldset>
 <p id="category-translations-help" className="categoryTranslationHint">{loading?'თარგმანების ველები იტვირთება…':translationsReady?'ცნობილი კატეგორიების თარგმანები ავტომატურად ივსება. შეგიძლიათ ხელით შეცვალოთ. უცნობი დასახელებები ხელით თარგმნეთ.':'ცნობილი კატეგორიები ავტომატურად ითარგმნება. ინდივიდუალური თარგმანების ველები ბაზის განახლების შემდეგ ჩაირთვება. სხვა მონაცემების შეცვლა ახლაც შეგიძლიათ.'}</p>
 <label className="v5Full">აღწერა<textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
 <label className="adminCheck"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/>აქტიური კატეგორია</label>
 <div className="v5FormActions"><button className="v5Primary" disabled={busy}>{busy?'ინახება...':editing?'ცვლილებების შენახვა':'კატეგორიის დამატება'}</button>{editing&&<button type="button" onClick={resetEditor}>გაუქმება</button>}</div></form>
 <div className="v5Panel"><div className="v5PanelHead"><h2>კატეგორიები</h2><span>{items.length} ჩანაწერი</span></div>{loading?<p>იტვირთება...</p>:items.length?items.map(c=><div className="categoryManagementRow" key={c.id}><div><strong>{c.name}</strong><small>/{c.slug} · რიგითობა {c.sortOrder}</small></div><span className={c.active?'v5Pill':'v5Pill muted'}>{c.active?'აქტიური':'დამალული'}</span><div className="v5RowActions"><button disabled={busy} onClick={()=>edit(c)}>რედაქტირება</button><button disabled={busy} onClick={()=>void toggle(c)}>{c.active?'დამალვა':'გამოჩენა'}</button><button disabled={busy} className="danger" onClick={()=>void remove(c)}>წაშლა</button></div></div>):<p className="adminEmpty">კატეგორიები ჯერ არ არის.</p>}</div></>;
}
