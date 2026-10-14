import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';
const testUrl=process.env.TEST_DATABASE_URL;
if(!testUrl)throw new Error('TEST_DATABASE_URL must point to a disposable local topuria_v7_test database');
const parsed=new URL(testUrl);
if(!['127.0.0.1','localhost'].includes(parsed.hostname)||parsed.pathname!=='/topuria_v7_test')
  throw new Error('Refusing to run fixtures against a non-local or non-test database');
process.env.DATABASE_URL=testUrl;
const db=new PrismaClient({datasourceUrl:testUrl});
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3000';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw new Error('TEST_BASE_URL must be local');
const password='isolated-test-password';
let ownerCookie='',operatorCookie='',activeId=0,prepared=false;
async function request(path:string,method='GET',data?:unknown,cookie?:string,origin=base){
  return fetch(base+path,{method,headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},...(data===undefined?{}:{body:JSON.stringify(data)}),redirect:'manual'});
}
before(async()=>{
  assert.equal(await db.product.count(),0,'Test database must be empty');
  assert.equal(await db.adminUser.count(),0,'Test database must be empty');
  prepared=true;
  await db.category.createMany({data:[{name:'Validation dresses',slug:'v7-test-dresses'},{name:'Hidden category',slug:'v7-test-hidden',active:false}]});
  const passwordHash=await bcrypt.hash(password,10);
  await db.adminUser.createMany({data:[
    {email:'owner@v7.test',name:'V7 Owner',passwordHash,role:'ADMIN',viewCost:true,viewStatistics:true,manageUsers:true,deleteProducts:true,manageOrders:true},
    {email:'operator@v7.test',name:'V7 Operator',passwordHash,role:'OPERATOR',viewCost:false,viewStatistics:false,manageUsers:false,deleteProducts:false,manageOrders:true},
  ]});
  for(const [email,set] of [['owner@v7.test',(s:string)=>ownerCookie=s],['operator@v7.test',(s:string)=>operatorCookie=s]] as const){
    const r=await request('/api/admin/login','POST',{email,password});assert.equal(r.status,200);
    const header=r.headers.get('set-cookie');assert.ok(header);assert.match(header,/HttpOnly/i);set(header.split(';')[0]);
  }
});
after(async()=>{
  // Never clean pre-existing data when the empty-database prerequisite failed.
  if(!prepared){await db.$disconnect();return}
  // The guard above ensures these deletions cannot touch Neon or another database.
  await db.orderItem.deleteMany();await db.order.deleteMany();await db.analyticsEvent.deleteMany();
  await db.product.deleteMany();await db.category.deleteMany();await db.adminUser.deleteMany();await db.$disconnect();
});
test('Admin-created product appears in every public catalog field without cost',async()=>{
  const r=await request('/api/admin/products','POST',{name:'V7 validation dress',slug:'v7-test-dress',sku:'V7-TEST-001',category:'v7-test-dresses',price:240,salePrice:190,stock:3,cost:80,sizes:'S, M',colors:'ბორდო',description:'Validation only',imageUrl:'/brand/logo-burgundy.png',status:'ACTIVE'},ownerCookie);
  assert.equal(r.status,201);const p=await r.json();activeId=p.id;
  const catalog=await (await request('/api/catalog')).json();const publicProduct=catalog.products.find((p:{slug:string})=>p.slug==='v7-test-dress');
  assert.equal(publicProduct.price,190);assert.equal(publicProduct.oldPrice,240);assert.equal(publicProduct.stock,3);
  assert.equal(publicProduct.imageUrl,'/brand/logo-burgundy.png');assert.deepEqual(publicProduct.sizes,['S','M']);assert.equal(publicProduct.categoryName,'Validation dresses');
  assert.equal('cost' in publicProduct,false);assert.equal('sku' in publicProduct,false);
  for(const path of ['/','/shop','/search','/wishlist','/cart','/product/v7-test-dress']){
    const page=await request(path);assert.equal(page.status,200,path);assert.match(await page.text(),/V7 validation dress/,path);
  }
});
test('Product edits are immediately visible; draft and hidden products stay private',async()=>{
  const form={id:activeId,name:'V7 validation dress',slug:'v7-test-dress',sku:'V7-TEST-001',category:'v7-test-dresses',price:260,salePrice:200,stock:2,cost:80,sizes:'S,M',imageUrl:'/brand/logo-burgundy.png',status:'ACTIVE'};
  assert.equal((await request('/api/admin/products','PATCH',form,ownerCookie)).status,200);
  const p=await (await request('/api/catalog')).json();assert.equal(p.products[0].price,200);assert.equal(p.products[0].stock,2);
  assert.equal((await request('/api/admin/products','POST',{...form,id:undefined,slug:'v7-test-draft',sku:'V7-DRAFT',status:'DRAFT'},ownerCookie)).status,201);
  await db.product.create({data:{name:'Hidden fixture',slug:'v7-test-hidden',sku:'V7-HIDDEN',category:'v7-test-hidden',price:10,status:'ACTIVE'}});
  assert.equal((await request('/api/admin/products','PATCH',{id:activeId,stock:6},ownerCookie)).status,200);
  assert.equal((await db.product.findUniqueOrThrow({where:{id:activeId}})).stock,6);
  const hidden=await (await request('/api/catalog')).json();assert.equal(hidden.products.length,1);assert.equal(hidden.categories.some((c:{slug:string})=>c.slug==='v7-test-hidden'),false);
  assert.equal((await request('/product/v7-test-draft')).status,404);
});
test('Permissions, origin checks, validation and password hashes stay protected',async()=>{
  assert.equal((await request('/api/admin/products')).status,401);
  assert.equal((await request('/api/admin/products','POST',{},ownerCookie,'https://other.example')).status,403);
  assert.equal((await request('/api/admin/products','POST',{name:'Invalid',slug:'bad',sku:'bad',category:'v7-test-dresses',price:-10},ownerCookie)).status,400);
  assert.equal((await request('/api/admin/products?id='+activeId,'DELETE',undefined,operatorCookie)).status,403);
  const rows=await (await request('/api/admin/products','GET',undefined,operatorCookie)).json();assert.ok(rows.every((p:object)=>!('cost' in p)));
  const operator=await db.adminUser.findUniqueOrThrow({where:{email:'operator@v7.test'}});
  const changed=await request('/api/admin/users','PATCH',{id:operator.id,key:'exportCsv',value:true},ownerCookie);
  assert.equal(changed.status,200);assert.equal('passwordHash' in await changed.json(),false);
  assert.equal((await request('/admin/analytics','GET',undefined,operatorCookie)).status,307);
  assert.equal((await request('/api/admin/cloudinary-sign','POST',{paramsToSign:{timestamp:Math.floor(Date.now()/1000),folder:'other-folder'}},ownerCookie)).status,400);
  assert.equal((await request('/api/admin/cloudinary-sign','POST',{})).status,401);
  const signed=await request('/api/admin/cloudinary-sign','POST',{paramsToSign:{timestamp:Math.floor(Date.now()/1000),folder:'topuria-premium/products'}},ownerCookie);
  assert.equal(signed.status,200);assert.match((await signed.json()).signature,/^[a-f0-9]{40}$/);

  const event={type:'page_view',path:'/shop',sessionId:'00000000-0000-4000-8000-000000000001',source:'Instagram',device:'Mobile'};
  assert.equal((await request('/api/analytics/track','POST',{...event,type:'unknown'})).status,400);
  assert.equal((await request('/api/analytics/track','POST',event,undefined,'https://other.example')).status,403);
  assert.equal((await request('/api/analytics/track','POST',event)).status,200);
  assert.equal(await db.analyticsEvent.count(),1);

});
test('Category editing preserves product links and partial toggles preserve category data',async()=>{
  const c=await db.category.findUniqueOrThrow({where:{slug:'v7-test-dresses'}});
  const edited=await request('/api/admin/categories','PATCH',{id:c.id,name:'Updated category',description:'Edited description',sortOrder:5},ownerCookie);
  assert.equal(edited.status,200);assert.equal((await edited.json()).description,'Edited description');
  const catalog=await (await request('/api/catalog')).json();assert.equal(catalog.products[0].categoryName,'Updated category');
  assert.equal((await request('/api/admin/categories','PATCH',{id:c.id,active:false},ownerCookie)).status,200);
  const stored=await db.category.findUniqueOrThrow({where:{id:c.id}});assert.equal(stored.name,'Updated category');assert.equal(stored.sortOrder,5);
  assert.equal((await (await request('/api/catalog')).json()).products.length,0);
  assert.equal((await request('/api/admin/categories','PATCH',{id:c.id,active:true},ownerCookie)).status,200);
  assert.equal((await request('/api/admin/categories','PATCH',{id:c.id,slug:'break-product-links'},ownerCookie)).status,400);
  assert.equal((await request('/api/admin/categories?id='+c.id,'DELETE',undefined,ownerCookie)).status,409);
});
test('Operator creation and profile editing preserve existing password hashes unless explicitly changed',async()=>{
  const created=await request('/api/admin/users','POST',{name:'New test operator',email:'new@v7.test',password:'temporary-validation-password'},ownerCookie);
  assert.equal(created.status,201);const user=await created.json();assert.equal(user.role,'OPERATOR');assert.equal('passwordHash' in user,false);
  const before=await db.adminUser.findUniqueOrThrow({where:{id:user.id}});
  assert.equal((await request('/api/admin/users','PATCH',{id:user.id,name:'Edited operator',email:'edited@v7.test',password:''},ownerCookie)).status,200);
  const after=await db.adminUser.findUniqueOrThrow({where:{id:user.id}});assert.equal(after.passwordHash,before.passwordHash);assert.equal(after.email,'edited@v7.test');
  const login=await request('/api/admin/login','POST',{email:'edited@v7.test',password:'temporary-validation-password'});assert.equal(login.status,200);
  const owner=await db.adminUser.findUniqueOrThrow({where:{email:'owner@v7.test'}});
  assert.equal((await request('/api/admin/users','PATCH',{id:owner.id,key:'active',value:false},ownerCookie)).status,400);
  assert.equal((await request('/api/admin/users','POST',{name:'Duplicate',email:'edited@v7.test',password:'temporary-validation-password'},ownerCookie)).status,409);
});
test('Analytics revenue excludes cancelled and unfulfilled orders, uses stored events',async()=>{
  const today=new Date();today.setUTCHours(12,0,0,0);
  for(const [orderNo,status,total] of [['V7-DELIVERED','DELIVERED',200],['V7-CANCELLED','CANCELLED',999],['V7-NEW','NEW',300]] as const){
    await db.order.create({data:{orderNo,status,total,customerName:'Validation only',phone:'test-only',createdAt:today,items:{create:{productId:activeId,name:'V7 validation dress',price:total,cost:80,quantity:1}}}});
  }
  const sessionId='00000000-0000-4000-8000-000000000001';
  await db.analyticsEvent.createMany({data:['page_view','product_view','add_to_cart'].map(type=>({type,sessionId,source:'Instagram',device:'Mobile',productSlug:'v7-test-dress',createdAt:today}))});
  const {getMetrics}=await import('../lib/metrics');const m=await getMetrics(7);
  assert.equal(m.revenue,200);assert.equal(m.profit,120);assert.equal(m.validOrders,2);assert.equal(m.cancelled,1);assert.equal(m.sessions,1);assert.equal(m.viewSessions,1);assert.equal(m.cartSessions,1);
  assert.equal(m.topProducts[0].quantity,1);assert.equal(m.daily.reduce((n,d)=>n+d.revenue,0),200);
  for(const path of ['/admin/dashboard','/admin/analytics','/admin/orders','/admin/users','/admin/customers','/admin/products','/admin/categories']){
    const r=await request(path,'GET',undefined,ownerCookie);assert.equal(r.status,200,path);
  }
  assert.equal((await request('/api/admin/products?id='+activeId,'DELETE',undefined,ownerCookie)).status,409);
  const order=await db.order.findUniqueOrThrow({where:{orderNo:'V7-DELIVERED'}});
  const updated=await request('/api/admin/orders','PATCH',{id:order.id,customerName:'Edited customer',phone:'test-updated',email:'customer@v7.test',address:'Test address'},ownerCookie);
  assert.equal(updated.status,200);assert.equal((await updated.json()).address,'Test address');
  const stored=await db.order.findUniqueOrThrow({where:{id:order.id},include:{items:true}});assert.equal(stored.total,200);assert.equal(stored.status,'DELIVERED');assert.equal(stored.items.length,1);

});
