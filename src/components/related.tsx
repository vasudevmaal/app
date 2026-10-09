import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { Style } from '@/lib/types';
import { PinterestGrid, StyleCard } from './gallery';
import { AdSlot } from './ads';
import { collectionPath } from '@/lib/routes';

export function Related({ style, styles }: { style: Style; styles: Style[] }) {
  if (!styles.length) return null;
  return <section className="related-section"><div className="section-title"><div><span className="eyebrow">KEEP EXPLORING</span><h2>A little more your style.</h2></div><Link href={'/' + collectionPath(style.kind)}>View collection <ChevronRight size={16} /></Link></div><PinterestGrid>{styles.map(s => <StyleCard key={s.id} style={s} />)}</PinterestGrid><AdSlot position="related-bottom" /></section>;
}
