import {cookies} from 'next/headers';
import {randomBytes,createHash,scryptSync,timingSafeEqual,createCipheriv,createDecipheriv} from 'node:crypto';
import {one,query} from './db';
import type {User} from './types';
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function currentUser():Promise<User|null>{const token=(await cookies()).get('excpix_session')?.value;if(!token)return null;return one<User>('SELECT u.id,u.name,u.username,u.email,u.role,u.plan,u.plan_expires,u.permissions,u.created_at FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=$1 AND s.expires>now() AND u.active=true',[tokenHash(token)]);}
export async function createSession(userId:string){const token=randomBytes(32).toString('hex');await query("INSERT INTO sessions(token,user_id,expires) VALUES($1,$2,now()+interval '30 days')",[tokenHash(token),userId]);(await cookies()).set('excpix_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.APP_URL?.startsWith('https://')??false,path:'/',maxAge:2592000});}
export function checkPassword(password:string,stored:string){const [salt,hash]=stored.split(':');if(!salt||!hash)return false;const actual=scryptSync(password,salt,64);const expected=Buffer.from(hash,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);}
export function hasPermission(user:User|null,permission:string){return !!user&&(user.role==='owner'||(['admin','moderator','support'].includes(user.role)&&user.permissions.includes(permission)));}
export function isPaid(user:User|null){return !!user&&(['owner','admin'].includes(user.role)||(user.plan!=='free'&&!!user.plan_expires&&new Date(user.plan_expires)>new Date()));}
export function key(){
  const configured=process.env.ENCRYPTION_KEY;
  // Demo mode needs to work out of the box; production still requires a real secret.
  const k=configured || (process.env.DEMO_MODE==='true' ? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' : '');
  if(!/^[a-f0-9]{64}$/i.test(k)) throw new Error('Set ENCRYPTION_KEY to 64 hexadecimal characters before saving credentials.');
  return Buffer.from(k,'hex');
}
export function encrypt(value:string){if(!value)return '';const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv.toString('hex'),encrypted.toString('hex'),cipher.getAuthTag().toString('hex')].join(':');}
export function decrypt(value:string){if(!value)return '';const [iv,data,tag]=value.split(':');const cipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'hex'));cipher.setAuthTag(Buffer.from(tag,'hex'));return Buffer.concat([cipher.update(Buffer.from(data,'hex')),cipher.final()]).toString('utf8');}
export async function rateLimit(key:string,max=20){const row=await one<{count:number}>("INSERT INTO rate_limits(key,count,expires) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires<now() THEN 1 ELSE rate_limits.count+1 END,expires=CASE WHEN rate_limits.expires<now() THEN now()+interval '15 minutes' ELSE rate_limits.expires END RETURNING count",[key]);if((row?.count||0)>max)throw new Error('Too many attempts. Please try again in 15 minutes.');}
