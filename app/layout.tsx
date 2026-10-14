import './styles.css';
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import {StoreProvider} from './store';
import {PreferencesProvider} from './preferences';
const poppins=Poppins({subsets:['latin'],weight:['300','400','500','600','700','800'],display:'swap',variable:'--font-poppins'});
export const metadata: Metadata={title:'Topuria Premium',description:'Premium women’s fashion in Georgia'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ka"><body className={poppins.variable}><PreferencesProvider><StoreProvider>{children}</StoreProvider></PreferencesProvider></body></html>}
