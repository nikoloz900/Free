import './styles.css';
import './v7.css';
import type { Metadata } from 'next';
import {StoreProvider} from './store';
import {PreferencesProvider} from './preferences';
import {CatalogProvider} from './catalog';
import {getPublicCatalog} from '../lib/catalog';
import {AnalyticsTracker} from './tracking';
export const dynamic='force-dynamic';
export const metadata: Metadata={title:{default:'Topuria Premium',template:'%s · Topuria Premium'},description:'Topuria Premium — თანამედროვე ქალის მოდა.'};
export default async function RootLayout({children}:{children:React.ReactNode}){
  let catalog:Awaited<ReturnType<typeof getPublicCatalog>>={products:[],categories:[]};let error='';
  try{catalog=await getPublicCatalog()}catch{error='კატალოგი დროებით მიუწვდომელია. სცადეთ ხელახლა.'}
  return <html lang="ka"><body><PreferencesProvider><CatalogProvider initial={catalog} error={error}><StoreProvider><AnalyticsTracker/>{children}</StoreProvider></CatalogProvider></PreferencesProvider></body></html>;
}
