export type Product = { slug:string; name:string; ka:string; price:number; tone:string; categories:string[]; oldPrice?:number };
export const products: Product[] = [
 {slug:'burgundy-signature-dress',name:'Signature Burgundy Dress',ka:'ელეგანტური კაბა',price:149,tone:'burgundy',categories:['new','dresses','plus']},
 {slug:'black-tailored-set',name:'Black Tailored Set',ka:'კლასიკური კოსტიუმი',price:169,tone:'black',categories:['new','suits']},
 {slug:'ivory-coat',name:'Ivory Coat',ka:'ქალის პალტო',price:199,oldPrice:229,tone:'ivory',categories:['sale','plus']},
 {slug:'mocha-set',name:'Mocha Set',ka:'მოკასფერი ორეული',price:159,oldPrice:179,tone:'mocha',categories:['suits','sale']}
];
