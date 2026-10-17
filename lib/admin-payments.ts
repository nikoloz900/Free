import {Prisma} from '@prisma/client';
import {db} from './db';

export type AdminPaymentSummary={
  id:string;status:string;method:string;environment:string;providerOrderId:string|null;
  stockReleased:boolean;amountMinor:number;currency:string;expiresAt:string;paidAt:string|null;
  lastCheckedAt:string|null;rawStatus:string|null;
};

// A deliberate allowlist: payment credentials, checkout tokens and idempotency
// keys must never reach the admin browser, even for an owner account.
export const adminPaymentSelect={
  id:true,orderId:true,status:true,method:true,environment:true,providerOrderId:true,
  stockReleased:true,amountMinor:true,currency:true,expiresAt:true,paidAt:true,
  lastCheckedAt:true,rawStatus:true,
} as const;

type AdminPaymentRecord={
  id:string;orderId:number;status:string;method:string;environment:string;providerOrderId:string|null;
  stockReleased:boolean;amountMinor:number;currency:string;expiresAt:Date;paidAt:Date|null;
  lastCheckedAt:Date|null;rawStatus:string|null;
};

export function serializeAdminPayment(payment:AdminPaymentRecord):AdminPaymentSummary{
  return {
    id:payment.id,status:payment.status,method:payment.method,environment:payment.environment,
    providerOrderId:payment.providerOrderId,stockReleased:payment.stockReleased,
    amountMinor:payment.amountMinor,currency:payment.currency,expiresAt:payment.expiresAt.toISOString(),
    paidAt:payment.paidAt?.toISOString()??null,lastCheckedAt:payment.lastCheckedAt?.toISOString()??null,
    rawStatus:payment.rawStatus,
  };
}

export function isMissingPaymentTable(error:unknown){
  return error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2021'
    &&typeof error.meta?.table==='string'
    &&/(?:^|\.)Payment$/.test(error.meta.table.replaceAll('"',''));
}

export async function getOrderPayments(orderIds:number[]):Promise<Map<number,AdminPaymentSummary>>{
  if(!orderIds.length)return new Map();
  try{
    const rows=await db.payment.findMany({where:{orderId:{in:orderIds}},select:adminPaymentSelect});
    return new Map(rows.map(payment=>[payment.orderId,serializeAdminPayment(payment)]));
  }catch(error){
    // Existing stores keep working until the additive payment migration is run.
    // Connectivity and permission failures are deliberately allowed to surface.
    if(isMissingPaymentTable(error))return new Map();
    throw error;
  }
}

export class AdminOrderConflictError extends Error{}
type AdminOrderUpdate={status?:string;customerName?:string;phone?:string;email?:string|null;address?:string|null};
const orderUpdateSelect={id:true,status:true,customerName:true,phone:true,email:true,address:true} as const;

export async function updateAdminOrder(id:number,data:AdminOrderUpdate){
  // Check outside the transaction: a missing PostgreSQL relation aborts its
  // transaction and must not turn an otherwise valid legacy edit into a 500.
  try{await db.payment.findUnique({where:{orderId:id},select:{id:true}})}
  catch(error){
    if(isMissingPaymentTable(error))return db.order.update({where:{id},data,select:orderUpdateSelect});
    throw error;
  }
  return db.$transaction(async transaction=>{
    // Reconciliation uses the same payment-first lock ordering. A bank callback
    // cannot change this payment between the guard and the order update.
    await transaction.$queryRaw`SELECT "id" FROM "Payment" WHERE "orderId"=${id} FOR UPDATE`;
    const payment=await transaction.payment.findUnique({where:{orderId:id},select:{status:true,environment:true,stockReleased:true}});
    if(payment&&data.status!==undefined){
      if(data.status==='CANCELLED')throw new AdminOrderConflictError('ონლაინ შეკვეთის გაუქმებას ბანკთან დადასტურებული გაუქმება ან თანხის დაბრუნება სჭირდება.');
      if(payment.status!=='PAID')throw new AdminOrderConflictError('მიწოდების სტატუსის შეცვლა მხოლოდ ბანკის მიერ დადასტურებული გადახდის შემდეგ შეიძლება.');
      if(payment.environment!=='production')throw new AdminOrderConflictError('სატესტო გადახდის შეკვეთა რეალურ მიწოდებაში ვერ გადავა.');
      if(payment.stockReleased)throw new AdminOrderConflictError('შეკვეთის მარაგის ჯავშანი მოხსნილია. გადახდა და მარაგი შესამოწმებელია.');
      if(!['CONFIRMED','PREPARING','SHIPPED','DELIVERED'].includes(data.status))throw new AdminOrderConflictError('გადახდის სტატუსს ბანკი ადასტურებს. აირჩიეთ მიწოდების სტატუსი.');
    }
    return transaction.order.update({where:{id},data,select:orderUpdateSelect});
  });
}
