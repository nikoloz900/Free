import './styles.css';
import './v7.css';
import type { Metadata } from 'next';
import {StoreProvider} from './store';
import {PreferencesProvider} from './preferences';
import {CatalogProvider} from './catalog';
import {getPublicCatalog} from '../lib/catalog';
import {AnalyticsTracker} from './tracking';
export const dynamic='force-dynamic';
const siteUrl='https://topuriapremium.ge';
export const metadata: Metadata={
 metadataBase:new URL(siteUrl),
 title:{default:'Topuria Premium | ქალის ტანსაცმლის ონლაინ მაღაზია',template:'%s | Topuria Premium'},
 description:'აღმოაჩინეთ Topuria Premium-ის ქალის ტანსაცმლის კოლექციები — ელეგანტური კაბები, კოსტიუმები, პერანგები და მოდური სამოსი. შეარჩიეთ თქვენი სტილი ონლაინ.',
 applicationName:'Topuria Premium',
 alternates:{canonical:'/'},
 openGraph:{type:'website',locale:'ka_GE',siteName:'Topuria Premium',url:siteUrl,title:'Topuria Premium | ქალის ტანსაცმლის ონლაინ მაღაზია',description:'ქალის ტანსაცმლის გამორჩეული კოლექციები — კაბები, კოსტიუმები, პერანგები და თანამედროვე სტილი.'},
 robots:{index:true,follow:true,googleBot:{index:true,follow:true}},
};
export default async function RootLayout({children}:{children:React.ReactNode}){
  let catalog:Awaited<ReturnType<typeof getPublicCatalog>>={products:[],categories:[]};let error='';
  try{catalog=await getPublicCatalog()}catch{error='კატალოგი დროებით მიუწვდომელია. სცადეთ ხელახლა.'}
  return <html lang="ka"><body><PreferencesProvider><CatalogProvider initial={catalog} error={error}><StoreProvider><AnalyticsTracker/>{children}</StoreProvider></CatalogProvider></PreferencesProvider></body></html>;
}
