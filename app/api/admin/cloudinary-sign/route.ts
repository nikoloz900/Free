import {rejectCrossOrigin} from '../../../../lib/request';
import {NextResponse} from 'next/server';
import {v2 as cloudinary} from 'cloudinary';
import {getAdmin} from '../../../../lib/auth';

export async function POST(request:Request){const blocked=rejectCrossOrigin(request);if(blocked)return blocked;
  const admin=await getAdmin();
  if(!admin)return NextResponse.json({error:'ადმინის სესია დასრულდა. შედით ხელახლა.'},{status:401});
  const apiSecret=process.env.CLOUDINARY_API_SECRET;
  const apiKey=process.env.CLOUDINARY_API_KEY;
  const cloudName=process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if(!apiSecret||!apiKey||!cloudName)return NextResponse.json({error:'Cloudinary-ის კონფიგურაცია არასრულია. შეამოწმეთ გარემოს ცვლადები Vercel-ში.'},{status:503});
  try{
    const body=await request.json();
    const params=body?.paramsToSign;
    if(!params||typeof params!=='object'||Array.isArray(params))return NextResponse.json({error:'Invalid upload parameters'},{status:400});
    // The upload widget supplies timestamp and its own upload parameters.
    // Do not sign arbitrary folders or destructive upload options.
    const allowed=new Set(['timestamp','folder','source','tags','context','unique_filename','use_filename','asset_folder','display_name']);
    if(Object.keys(params).some(k=>!allowed.has(k)))return NextResponse.json({error:'Unsupported upload parameter'},{status:400});
    if(params.folder!==undefined&&params.folder!=='topuria-premium/products')return NextResponse.json({error:'Invalid folder'},{status:400});
    const timestamp=Number(params.timestamp);
    if(!Number.isFinite(timestamp)||Math.abs(Math.floor(Date.now()/1000)-timestamp)>300)return NextResponse.json({error:'ატვირთვის მოთხოვნის დრო ამოიწურა. სცადეთ ხელახლა.'},{status:400});
    const signature=cloudinary.utils.api_sign_request(params,apiSecret);
    return NextResponse.json({signature});
  }catch{return NextResponse.json({error:'ფოტოს ატვირთვის მომზადება ვერ შესრულდა.'},{status:400});}
}
