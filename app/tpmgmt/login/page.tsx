'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export default function Login(){
  const router=useRouter();const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
    try{const r=await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});const x=await r.json();
      if(!r.ok){setError(x.error||'შესვლა ვერ შესრულდა');return}router.replace('/tpmgmt/dashboard');router.refresh();
    }catch{setError('კავშირი ვერ დამყარდა. სცადეთ ხელახლა.')}finally{setBusy(false)}
  }
  return <main className="adminLogin"><form onSubmit={submit}><div className="adminCrown">T</div><h1>TOPURIA</h1><p>PREMIUM · STUDIO V7</p><label>ელფოსტა<input required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} type="email"/></label><label>პაროლი<input required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} type="password"/></label>{error&&<div role="alert" className="loginError">{error}</div>}<button disabled={busy}>{busy?'მოწმდება...':'შესვლა'}</button><small>დაცული ადმინისტრაციული სივრცე</small><Link href="/" style={{display:'block',marginTop:20,fontSize:10}}>← მაღაზია</Link></form></main>;
}
