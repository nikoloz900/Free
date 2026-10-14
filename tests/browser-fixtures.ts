import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';
const value=process.env.TEST_DATABASE_URL;
if(!value)throw new Error('TEST_DATABASE_URL is required');
const u=new URL(value);
if(!['127.0.0.1','localhost'].includes(u.hostname)||u.pathname!=='/topuria_v7_test')throw new Error('Only disposable local test databases are allowed');
const db=new PrismaClient({datasourceUrl:value});
async function main(){try{
  if(process.argv.includes('--clean')){
    await db.orderItem.deleteMany();await db.order.deleteMany();await db.analyticsEvent.deleteMany();await db.product.deleteMany();await db.category.deleteMany();await db.adminUser.deleteMany();
  }else{
    if(await db.product.count()||await db.adminUser.count())throw new Error('Test database must be empty');
    await db.adminUser.create({data:{name:'V7 Studio',email:'owner@v7.test',passwordHash:await bcrypt.hash('isolated-test-password',10),role:'ADMIN',viewStatistics:true,viewCost:true,manageOrders:true,manageUsers:true,manageCustomers:true,deleteProducts:true}});
    await db.category.create({data:{name:'კაბები',slug:'v7-test-dresses'}});
    await db.product.createMany({data:[
      {name:'V7 სატესტო კაბა',slug:'v7-test-dress',sku:'V7-DRESS',category:'v7-test-dresses',description:'მხოლოდ იზოლირებული ტესტისთვის.',price:240,salePrice:190,cost:80,stock:3,sizes:'S,M',colors:'ბორდო',imageUrl:'/brand/logo-burgundy.png'},
      {name:'V7 სატესტო მეორე მოდელი',slug:'v7-test-second',sku:'V7-SECOND',category:'v7-test-dresses',price:350,stock:10,sizes:'M,L',imageUrl:'/brand/logo-white.png'},
    ]});
    const product=await db.product.findUniqueOrThrow({where:{slug:'v7-test-dress'}});
    const today=new Date();today.setUTCHours(12,0,0,0);
    await db.order.create({data:{orderNo:'V7-TEST-ORDER',customerName:'სატესტო მომხმარებელი',phone:'test-only',total:190,status:'DELIVERED',createdAt:today,items:{create:{productId:product.id,name:product.name,price:190,cost:80,quantity:1}}}});
    await db.analyticsEvent.createMany({data:['page_view','product_view','add_to_cart'].map(type=>({type,source:'Instagram',sessionId:'00000000-0000-4000-8000-000000000001',device:'Mobile',createdAt:today}))});
  }
  console.log('Disposable browser fixtures '+(process.argv.includes('--clean')?'removed':'prepared'));
}finally{await db.$disconnect()}

}
void main().catch(()=>{console.error("Disposable fixture preparation failed");process.exitCode=1});
