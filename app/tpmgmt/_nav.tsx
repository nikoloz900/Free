import type {AdminUser} from '@prisma/client';
import AdminChrome from './tpmgmt-chrome';
export default function AdminNav({active,admin}:{active:string;admin:AdminUser}){
  const links=[{id:'dashboard',label:'მთავარი',href:'/tpmgmt/dashboard'},
    ...(admin.role==='ADMIN'?[{id:'categories',label:'კატეგორიები',href:'/tpmgmt/categories'}]:[]),
    {id:'products',label:'პროდუქტები',href:'/tpmgmt/products'},
    ...(admin.manageOrders?[{id:'orders',label:'შეკვეთები',href:'/tpmgmt/orders'}]:[]),
    ...((admin.role==='ADMIN'||admin.viewStatistics)?[{id:'analytics',label:'ანალიტიკა',href:'/tpmgmt/analytics'}]:[]),
    ...(admin.manageUsers?[{id:'users',label:'ოპერატორები',href:'/tpmgmt/users'}]:[]),
    ...(admin.manageCustomers?[{id:'customers',label:'მომხმარებლები',href:'/tpmgmt/customers'}]:[])];
  return <AdminChrome active={active} links={links} name={admin.name} role={admin.role}/>;
}
