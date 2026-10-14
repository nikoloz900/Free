import type {AdminUser} from '@prisma/client';
import AdminChrome from './admin-chrome';
export default function AdminNav({active,admin}:{active:string;admin:AdminUser}){
  const links=[{id:'dashboard',label:'მთავარი',href:'/admin/dashboard'},
    ...(admin.role==='ADMIN'?[{id:'categories',label:'კატეგორიები',href:'/admin/categories'}]:[]),
    {id:'products',label:'პროდუქტები',href:'/admin/products'},
    ...(admin.manageOrders?[{id:'orders',label:'შეკვეთები',href:'/admin/orders'}]:[]),
    ...(admin.viewStatistics?[{id:'analytics',label:'ანალიტიკა',href:'/admin/analytics'}]:[]),
    ...(admin.manageUsers?[{id:'users',label:'ოპერატორები',href:'/admin/users'}]:[]),
    ...(admin.manageCustomers?[{id:'customers',label:'მომხმარებლები',href:'/admin/customers'}]:[])];
  return <AdminChrome active={active} links={links} name={admin.name} role={admin.role}/>;
}
