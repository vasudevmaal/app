import {NextRequest, NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {randomUUID} from 'node:crypto';
import {one, query} from '@/lib/db';
import {decrypt, createSession} from '@/lib/auth';
import {safeEqual} from '@/lib/payments';

class SignInError extends Error {}

export async function GET(req: NextRequest) {
  const base = process.env.APP_URL || 'http://localhost:3000';
  if (req.headers.get('host') !== new URL(base).host) {
    const canonical = new URL('/api/auth/google/callback', base);
    canonical.search = req.nextUrl.search;
    return NextResponse.redirect(canonical);
  }
  let stage = 'state';
  try {
    const jar = await cookies();
    const state = jar.get('excpix_oauth_state')?.value;
    jar.delete('excpix_oauth_state');
    if (req.nextUrl.searchParams.get('error') === 'access_denied') throw new SignInError('cancelled');
    const code = req.nextUrl.searchParams.get('code');
    if (!code) throw new SignInError('missing_code');
    if (!state || !safeEqual(state, req.nextUrl.searchParams.get('state') || '')) throw new SignInError('expired_state');
    stage = 'configuration';
    const g = await one<{public_key:string;secret:string}>("SELECT public_key,secret FROM gateways WHERE id='google' AND enabled=true");
    if (!g?.public_key || !g.secret) throw new SignInError('configuration');
    let secret: string;
    try { secret = decrypt(g.secret).trim(); } catch { throw new SignInError('credentials'); }
    stage = 'token';
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method:'POST', body:new URLSearchParams({client_id:g.public_key.trim(),client_secret:secret,code,grant_type:'authorization_code',redirect_uri:base+'/api/auth/google/callback'}),
      signal:AbortSignal.timeout(15000),
    });
    const token = await response.json();
    if (!response.ok || !token.access_token) throw new SignInError(token.error === 'invalid_client' ? 'credentials' : token.error === 'invalid_grant' ? 'expired_code' : 'token');
    stage = 'profile';
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000),
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || profile.email_verified !== true || typeof profile.email !== 'string') throw new SignInError('profile');
    stage = 'account';
    const email = profile.email.toLowerCase();
    type Account = {id:string;username:string;role:string;active:boolean};
    let u = await one<Account>('SELECT id,username,role,active FROM users WHERE email=$1',[email]);
    if (!u) {
      const id = randomUUID();
      await query('INSERT INTO users(id,name,username,email) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING',[id,String(profile.name || 'Creator').slice(0,60),'creator-'+id.slice(0,8),email]);
      u = await one<Account>('SELECT id,username,role,active FROM users WHERE email=$1',[email]);
    }
    if (!u) throw new SignInError('account');
    if (!u.active) throw new SignInError('blocked');
    stage = 'session';
    await createSession(u.id);
    return NextResponse.redirect(new URL(u.role === 'owner' ? '/owner' : '/user/'+u.username, base));
  } catch (error) {
    const reason = error instanceof SignInError ? error.message : 'unavailable';
    // Log safe diagnostic codes without authorization codes, tokens or secrets.
    console.error('[Google OAuth]', stage, reason);
    const login = new URL('/login', base);
    login.searchParams.set('oauth_error', reason);
    return NextResponse.redirect(login);
  }
}
