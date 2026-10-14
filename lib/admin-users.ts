import type {Prisma} from '@prisma/client';
export const adminUserSelect={id:true,email:true,name:true,role:true,active:true,viewCost:true,viewStatistics:true,manageUsers:true,deleteProducts:true,manageOrders:true,exportCsv:true,manageCustomers:true} satisfies Prisma.AdminUserSelect;
export const permissions=['viewCost','viewStatistics','manageUsers','deleteProducts','manageOrders','exportCsv','manageCustomers'] as const;
export type ManagedUser={id:number;email:string;name:string;role:string;active:boolean} & Record<typeof permissions[number],boolean>;
