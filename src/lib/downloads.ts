import { randomUUID } from 'node:crypto';
import { query } from './db';
import { isPaid } from './auth';
import { isExportLocked } from './export-access';
import type { User, Style } from './types';

export async function reserveDownload(user: User | null, style: Style, quality: number, format: string, guestKey?: string, downloadText = '') {
  const paid = isPaid(user);
  if (isExportLocked(style.kind, paid, format, quality)) throw new Error('This export requires a paid plan. Free exports include PNG Standard and GIF Small or Medium.');
  if ((style.is_premium || !style.is_free) && !paid) throw new Error('This style requires a paid plan.');
  const id = randomUUID();
  if(!user && !guestKey) throw new Error('Unable to identify this download session.');
  // Keep existing local databases compatible with the stored editor text field.
  await query("ALTER TABLE downloads ADD COLUMN IF NOT EXISTS download_text TEXT NOT NULL DEFAULT ''", []);
  await query('INSERT INTO downloads(id,user_id,style_id,quality,format,download_text) VALUES($1,$2,$3,$4,$5,$6)', [id,user?.id ?? null,style.id,quality,format,downloadText.trim().slice(0, 20000)]);
  return { id, watermark: '', complete: () => query('UPDATE styles SET download_count=download_count+1 WHERE id=$1', [style.id]), cancel: async () => { await query('DELETE FROM downloads WHERE id=$1', [id]); } };
}
