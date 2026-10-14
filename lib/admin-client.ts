export async function adminRequest<T>(url:string,options:RequestInit={}):Promise<T>{
  let response:Response;
  try{response=await fetch(url,{cache:'no-store',...options})}catch{throw new Error('კავშირი ვერ დამყარდა. სცადეთ ხელახლა.')}
  let body;try{body=await response.json()}catch{throw new Error('სერვერის პასუხი ვერ დამუშავდა. სცადეთ ხელახლა.')}
  if(!response.ok)throw new Error(body?.error||(response.status===401?'სესია დასრულდა. შედით ხელახლა.':'შენახვა ვერ შესრულდა.'));
  return body as T;
}
export function adminJson(method:string,body:unknown):RequestInit{return {method,headers:{'content-type':'application/json'},body:JSON.stringify(body)}}
export function toSlug(name:string){
  const ka='აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ';
  const latin=['a','b','g','d','e','v','z','t','i','k','l','m','n','o','p','zh','r','s','t','u','f','k','gh','q','sh','ch','ts','dz','ts','ch','kh','j','h'];
  return Array.from(name.toLowerCase()).map(c=>ka.includes(c)?latin[ka.indexOf(c)]:c).join('').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100)||'item';
}
