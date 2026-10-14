import {PrismaClient} from '@prisma/client';import bcrypt from 'bcryptjs';
const db=new PrismaClient();
const products=[
['ბორდოს საღამოს კაბა','burgundy-evening-dress','TP-DRESS-001','კაბები',189,110,14],
['შავი კლასიკური კოსტიუმი','black-tailored-suit','TP-SUIT-002','კოსტიუმები',229,145,9],
['Ivory Premium პალტო','ivory-premium-coat','TP-COAT-003','პალტო',289,175,4],
['Mocha ორეული','mocha-two-piece','TP-SET-004','კოსტიუმები',179,105,7],
['Emerald Midi კაბა','emerald-midi-dress','TP-DRESS-005','კაბები',169,96,11],
['Plus Size Burgundy Dress','plus-burgundy-dress','TP-PLUS-006','პლუს ზომები',199,118,6],
['Champagne Blazer','champagne-blazer','TP-BLZR-007','ჟაკეტები',159,92,3],
['Black Satin Dress','black-satin-dress','TP-DRESS-008','SALE',139,88,5],
] as const;
async function main(){
 const adminHash=await bcrypt.hash(process.env.ADMIN_PASSWORD||'Topuria@2026!',12);const opHash=await bcrypt.hash(process.env.OPERATOR_PASSWORD||'Operator@2026!',12);
 await db.adminUser.upsert({where:{email:'admin@topuriapremium.ge'},update:{passwordHash:adminHash,role:'ADMIN',active:true,viewCost:true,viewStatistics:true,manageUsers:true,deleteProducts:true,manageOrders:true,exportCsv:true,manageCustomers:true},create:{email:'admin@topuriapremium.ge',passwordHash:adminHash,name:'Topuria Owner',role:'ADMIN',viewCost:true,viewStatistics:true,manageUsers:true,deleteProducts:true,manageOrders:true,exportCsv:true,manageCustomers:true}});
 await db.adminUser.upsert({where:{email:'operator@topuriapremium.ge'},update:{passwordHash:opHash},create:{email:'operator@topuriapremium.ge',passwordHash:opHash,name:'Topuria Operator',role:'OPERATOR',manageOrders:true,manageCustomers:true}});
 for(const [name,slug,sku,category,price,cost,stock] of products)await db.product.upsert({where:{slug},update:{name,sku,category,price,cost,stock},create:{name,slug,sku,category,price,cost,stock}});
 if(await db.order.count()===0){const ps=await db.product.findMany();const names=['ნინო ბერიძე','ანა მაისურაძე','მარიამ კაპანაძე','სალომე ლომიძე','თამარ გოგიძე','ქეთი ჩხეიძე','ელენე აბაშიძე','თაკო ჯაფარიძე'];const statuses=['DELIVERED','DELIVERED','SHIPPED','PREPARING','CONFIRMED','NEW'];for(let i=0;i<14;i++){const p=ps[i%ps.length],q=i%4===0?2:1,total=p.price*q;await db.order.create({data:{orderNo:`TP-${20261000+i+1}`,customerName:names[i%names.length],phone:`+995 555 20 ${String(3800+i).slice(-4)}`,total,status:statuses[i%statuses.length],source:['Instagram','Facebook','Direct','Google'][i%4],createdAt:new Date(Date.now()-(13-i)*86400000),items:{create:{productId:p.id,name:p.name,price:p.price,cost:p.cost,quantity:q,size:['S','M','L','XL'][i%4],color:['Burgundy','Black','Ivory','Mocha'][i%4]}}}})}}
 if(await db.analyticsEvent.count()===0){const ps=await db.product.findMany();const sources=['Instagram','Facebook','Direct','Google'];const devices=['Mobile','Mobile','Desktop'];for(let d=13;d>=0;d--){for(let j=0;j<18+d%5;j++){const session=`demo-${d}-${j}`,createdAt=new Date(Date.now()-d*86400000+j*120000);const p=ps[(d+j)%ps.length];await db.analyticsEvent.create({data:{type:'page_view',path:'/',sessionId:session,source:sources[j%4],device:devices[j%3],createdAt}});if(j%2===0)await db.analyticsEvent.create({data:{type:'product_view',path:`/product/${p.slug}`,productSlug:p.slug,sessionId:session,source:sources[j%4],device:devices[j%3],createdAt}});if(j%5===0)await db.analyticsEvent.create({data:{type:'add_to_cart',productSlug:p.slug,sessionId:session,source:sources[j%4],device:devices[j%3],createdAt}});if(j%9===0)await db.analyticsEvent.create({data:{type:'begin_checkout',sessionId:session,source:sources[j%4],device:devices[j%3],createdAt}});}}
 }
 console.log('Demo data ready. Admin: admin@topuriapremium.ge / Topuria@2026! | Operator: operator@topuriapremium.ge / Operator@2026!');
}
main().catch(console.error).finally(()=>db.$disconnect());
