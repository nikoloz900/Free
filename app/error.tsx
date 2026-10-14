'use client';
export default function ErrorPage({reset}:{error:Error & {digest?:string};reset:()=>void}){
  return <main className="appError"><span>TOPURIA PREMIUM</span><h1>გვერდი დროებით მიუწვდომელია</h1><p>სცადეთ ხელახლა რამდენიმე წუთში.</p><button className="btn" onClick={reset}>ხელახლა ცდა</button><a href="/">მთავარ გვერდზე დაბრუნება</a></main>;
}
