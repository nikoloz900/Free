import {rejectCrossOrigin} from '../../../../lib/request';
import {NextResponse} from 'next/server';import {clearSession} from '../../../../lib/auth';export async function POST(req:Request){const blocked=rejectCrossOrigin(req);if(blocked)return blocked;await clearSession();return NextResponse.json({ok:true});}
