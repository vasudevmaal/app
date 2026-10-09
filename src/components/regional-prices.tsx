'use client';
import { Plus, Trash2 } from 'lucide-react';
import { countries, currencies, currencyForCountry, currencyDigits } from '@/lib/billing';
import type { RegionalPrice } from '@/lib/types';

export function RegionalPrices({value, onChange}:{value:RegionalPrice[];onChange:(value:RegionalPrice[])=>void}) {
  const patch = (index:number, fields:Partial<RegionalPrice>) => onChange(value.map((row,i) => i === index ? {...row,...fields} : row));
  return <details open><summary>Country & currency prices</summary><div className="repeat-fields">{value.map((row,i) => <div className="repeat-field" key={i}>
    <div className="section-title"><strong>{row.country ? countries.find(c => c.code === row.country)?.name : 'All ' + row.currency + ' countries'}</strong><button type="button" className="icon-button danger" title="Remove regional price" onClick={() => onChange(value.filter((_,j) => j !== i))}><Trash2 size={16}/></button></div>
    <div className="two-fields"><label className="field"><span>Country</span><select value={row.country} onChange={e => patch(i,{country:e.target.value,...(e.target.value ? {currency:currencyForCountry(e.target.value)} : {})})}><option value="">All countries using this currency</option>{countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label><label className="field"><span>Currency</span><select disabled={!!row.country} value={row.currency} onChange={e => patch(i,{currency:e.target.value})}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label></div>
    <div className="two-fields">{(['price','yearly_price'] as const).map(field => <label key={field} className="field"><span>{field === 'price' ? 'Monthly price' : 'Yearly price'}</span><input type="number" min="0" max="1000000" step={10 ** -currencyDigits(row.currency)} value={row[field]} onChange={e => patch(i,{[field]:Number(e.target.value)})}/></label>)}</div>
    <fieldset className="gateway-checks"><legend>Payment gateways</legend>{['stripe','razorpay'].map(g => <label key={g}><input type="checkbox" checked={row.gateways.includes(g)} onChange={e => patch(i,{gateways:e.target.checked ? [...row.gateways,g] : row.gateways.filter(id => id !== g)})}/>{g === 'stripe' ? 'Stripe' : 'Razorpay'}</label>)}</fieldset>
    <label className="toggle-row"><span>Available in this market</span><input type="checkbox" checked={row.active} onChange={e => patch(i,{active:e.target.checked})}/></label>
  </div>)}</div><button type="button" className="button" onClick={() => onChange([...value,{country:'',currency:currencies.find(c => !value.some(p => !p.country && p.currency === c)) || 'USD',price:0,yearly_price:0,active:false,gateways:['stripe']}])}><Plus size={16}/>Add regional price</button></details>;
}
