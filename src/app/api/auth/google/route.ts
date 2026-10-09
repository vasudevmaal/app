import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {randomBytes} from 'node:crypto';
import {one} from '@/lib/db';
export async function GET(request: Request) {
  const base = process.env.APP_URL || 'http://localhost:3000';
  // Set the state cookie on the same host that will receive Google's callback.
  if (request.headers.get('host') !== new URL(base).host) {
    return NextResponse.redirect(new URL('/api/auth/google', base));
  }
  const g = await one<{enabled:boolean;public_key:string}>("SELECT enabled,public_key FROM gateways WHERE id='google'");
  if (!g?.enabled) return NextResponse.json({error:'Google sign-in is not configured.'},{status:503});
  const state = randomBytes(32).toString('hex');
  (await cookies()).set('excpix_oauth_state',state,{httpOnly:true,sameSite:'lax',secure:base.startsWith('https://'),maxAge:600,path:'/'});
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({client_id:g.public_key,redirect_uri:base+'/api/auth/google/callback',response_type:'code',scope:'openid email profile',state}).toString();
  return NextResponse.redirect(url);
}
