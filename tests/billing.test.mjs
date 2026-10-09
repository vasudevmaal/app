import test from 'node:test';
import assert from 'node:assert/strict';
import {currencyForCountry,detectCountry,minorAmount,majorAmount,pricedPlan,paymentGateways} from '../src/lib/billing.ts';

const base={id:'pro',price:299,yearly_price:2499,currency:'INR',active:true,regional_prices:[{country:'',currency:'USD',price:5,yearly_price:50,active:true,gateways:['stripe']},{country:'',currency:'EUR',price:4,yearly_price:40,active:true,gateways:['stripe']},{country:'FR',currency:'EUR',price:6,yearly_price:60,active:true,gateways:['stripe']},{country:'DE',currency:'EUR',price:4,yearly_price:40,active:false,gateways:['stripe']}]};
test('country pricing uses explicit prices, country overrides, and disabled markets',()=>{
  assert.equal(currencyForCountry('IN'),'INR');assert.equal(currencyForCountry('US'),'USD');assert.equal(currencyForCountry('GB'),'GBP');assert.equal(currencyForCountry('FR'),'EUR');
  assert.equal(pricedPlan(base,'IN').price,299);assert.equal(pricedPlan(base,'US').price,5);assert.equal(pricedPlan(base,'FR').price,6);assert.equal(pricedPlan(base,'ES').price,4);
  assert.equal(pricedPlan(base,'DE'),null);assert.equal(pricedPlan(base,'JP'),null);assert.equal(pricedPlan({...base,id:'free'},'JP').price,0);
  assert.deepEqual(paymentGateways(base,'US'),['stripe']);assert.deepEqual(paymentGateways(base,'IN'),['razorpay','stripe']);assert.deepEqual(paymentGateways(base,'DE'),[]);
});
test('payment amounts round trip in zero, two and three decimal currencies',()=>{
  for(const [currency,amount,minor] of [['INR',299,29900],['USD',4.99,499],['EUR',3.25,325],['JPY',499,499],['KWD',1.234,1234]]) {assert.equal(minorAmount(amount,currency),minor);assert.equal(majorAmount(minor,currency),amount);}
});
test('country detection prefers country header then explicit browser region',()=>{
  assert.equal(detectCountry(new Headers({'x-vercel-ip-country':'US','accept-language':'en-IN'})),'US');assert.equal(detectCountry(new Headers({'cf-ipcountry':'XX','accept-language':'en-GB'})),'GB');assert.equal(detectCountry(new Headers({'accept-language':'en'})),'IN');
});
