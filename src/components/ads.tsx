'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useApp } from './providers';

type ManualAdProps = { html: string; css: string; js: string };

function ManualAd({ html, css, js }: ManualAdProps) {
  const srcDoc = useMemo(
    () => `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;padding:0;background:transparent;font-family:system-ui,sans-serif}${css}</style></head><body>${html}<script>${js.replace(/<\/script/gi, '<\\/script')}<\/script></body></html>`,
    [html, css, js],
  );
  return <iframe title="Advertisement" className="manual-ad-frame" sandbox="allow-scripts allow-forms allow-popups" srcDoc={srcDoc} />;
}

export function AdSlot({ position }: { position: string }) {
  const { user, settings } = useApp();
  const path = usePathname();
  const ref = useRef<HTMLModElement>(null);
  const [manualFallback, setManualFallback] = useState(false);
  const slot = settings.ad_slots.find((item) => item.position === position && item.enabled);
  const paid = !!user && (['owner', 'admin'].includes(user.role) || (user.plan !== 'free' && !!user.plan_expires && new Date(user.plan_expires) > new Date()));
  const blockedPage = settings.ad_disabled_pages.some((page) => path.startsWith(page));
  const hasManual = !!slot?.manual_enabled && !!slot.manual_html?.trim();
  const externalEnabled = !!slot && /^\d+$/.test(slot.slot) && /^ca-pub-\d+$/.test(settings.ad_client);
  const showAds = settings.ads_enabled && !paid && !blockedPage && (externalEnabled || hasManual);
  const showExternal = showAds && externalEnabled && !manualFallback;

  useEffect(() => {
    setManualFallback(showAds && !externalEnabled);
  }, [showAds, externalEnabled, position]);

  useEffect(() => {
    if (!showExternal || !ref.current) return;
    const current = ref.current;
    const id = 'excpix-adsense';
    const push = () => {
      try { ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({}); }
      catch { setManualFallback(hasManual); }
    };
    const timer = window.setTimeout(() => {
      if (current.getAttribute('data-ad-status') !== 'filled') setManualFallback(hasManual);
    }, 1800);
    const script = document.getElementById(id) as HTMLScriptElement | null;
    if (script) {
      if ((window as any).adsbygoogle) push();
      else script.addEventListener('load', push, { once: true });
      return () => { window.clearTimeout(timer); script.removeEventListener('load', push); };
    }
    const next = document.createElement('script');
    next.id = id;
    next.async = true;
    next.crossOrigin = 'anonymous';
    next.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + settings.ad_client;
    next.addEventListener('load', push, { once: true });
    document.head.appendChild(next);
    return () => { window.clearTimeout(timer); next.removeEventListener('load', push); };
  }, [showExternal, settings.ad_client, slot?.slot, hasManual]);

  if (!showAds || !slot) return null;
  return <aside className="ad-slot main-width"><small>ADVERTISEMENT</small>{showExternal && <ins ref={ref} className="adsbygoogle" style={{ display: 'block' }} data-ad-client={settings.ad_client} data-ad-slot={slot.slot} data-ad-format="auto" data-full-width-responsive="true" />}{manualFallback && hasManual && <ManualAd html={slot.manual_html || ''} css={slot.manual_css || ''} js={slot.manual_js || ''} />}</aside>;
}
