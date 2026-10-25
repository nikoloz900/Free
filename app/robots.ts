import type {MetadataRoute} from 'next';
export default function robots():MetadataRoute.Robots{
 return {rules:[{userAgent:'*',allow:'/',disallow:['/admin/','/api/','/checkout','/account','/cart']}],sitemap:'https://topuriapremium.ge/sitemap.xml',host:'https://topuriapremium.ge'};
}
