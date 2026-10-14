export const money=(value:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value)+' ₾';
