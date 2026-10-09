import type { Plan } from './types';

export const currencyCountries: Record<string, string[]> = {
  INR:['IN'], USD:['US','EC','SV','PA','PR'], EUR:['AT','BE','BG','HR','CY','EE','FI','FR','DE','GR','IE','IT','LV','LT','LU','MT','NL','PT','SK','SI','ES'],
  JPY:['JP'], GBP:['GB'], AUD:['AU'], CAD:['CA'], CHF:['CH','LI'], CNY:['CN'], AED:['AE'],
};
export const currencies = Object.keys(currencyCountries);
const names = new Intl.DisplayNames(['en'], {type:'region'});
export const countries = Object.entries(currencyCountries).flatMap(([currency, codes]) => codes.map(code => ({code, currency, name:names.of(code) || code}))).sort((a,b) => a.name.localeCompare(b.name));
export function currencyForCountry(country: string) { return countries.find(c => c.code === country)?.currency || 'USD'; }
export function detectCountry(headers: {get(name:string):string|null}) {
  for (const key of ['x-vercel-ip-country','cf-ipcountry']) {
    const code = headers.get(key)?.toUpperCase();
    if (code && /^[A-Z]{2}$/.test(code)) return code;
  }
  const locale = headers.get('accept-language')?.split(',')[0]?.trim();
  try { const region = locale ? new Intl.Locale(locale).region : undefined; if(region) return region; } catch {}
  return 'IN';
}
export function currencyDigits(currency: string) { return new Intl.NumberFormat('en', {style:'currency',currency}).resolvedOptions().maximumFractionDigits ?? 2; }
export function minorAmount(amount: number, currency: string) { return Math.round((amount + Number.EPSILON) * 10 ** currencyDigits(currency)); }
export function majorAmount(amount: number, currency: string) { return amount / 10 ** currencyDigits(currency); }
export function money(amount: number, currency: string) { return new Intl.NumberFormat('en', {style:'currency',currency,currencyDisplay:'symbol'}).format(amount); }
export function pricedPlan(plan: Plan, country: string): Plan | null {
  const currency = currencyForCountry(country);
  if(plan.id === 'free') return {...plan, currency, price:0,yearly_price:0};
  const row = plan.regional_prices?.find(p => p.country === country) ?? plan.regional_prices?.find(p => !p.country && p.currency === currency);
  if(row) return row.active ? {...plan, ...row} : null;
  if (plan.currency === currency) return plan;
  if (currency === 'USD') {
    const fallback = plan.id === 'pro'
      ? { price: 12, yearly_price: 120 }
      : plan.id === 'studio'
        ? { price: 36, yearly_price: 360 }
        : { price: plan.price, yearly_price: plan.yearly_price };
    return { ...plan, ...fallback, currency: 'USD', gateways: ['stripe'] };
  }
  return null;
}
export function paymentGateways(plan: Plan, country: string) {
  const priced = pricedPlan(plan,country);
  return priced ? priced.gateways ?? (priced.currency === 'INR' ? ['razorpay','stripe'] : ['stripe']) : [];
}
