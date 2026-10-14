'use client';
import Link from 'next/link';
import {Header,Footer} from '../components';
export default function Account(){return <main className="v7Store directCatalog"><Header/><div className="accountPage"><span className="eyebrow">TOPURIA PREMIUM</span><h1>ჩემი ანგარიში</h1><p>მომხმარებლის ანგარიშები ჯერ მიუწვდომელია.</p><p>რჩეულებისა და კალათის გამოყენება ანგარიშის გარეშეც შეგიძლია.</p><Link className="btn" href="/wishlist">რჩეულების ნახვა</Link></div><Footer/></main>}
