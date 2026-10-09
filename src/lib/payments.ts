import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { one, query } from "./db";
import { decrypt } from "./auth";
import type { User, Plan } from "./types";
import { minorAmount, pricedPlan, paymentGateways } from './billing';
type Gateway = {
  id: string;
  enabled: boolean;
  public_key: string;
  secret: string;
  webhook_secret: string;
  mode: string;
};
export function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export async function checkout(
  user: User,
  provider: string,
  plan: Plan,
  period: string,
  coupon: string,
  country: string,
  origin: string,
) {
  const localized = pricedPlan(plan,country);
  if (!localized || !paymentGateways(plan,country).includes(provider)) throw new Error('This plan or payment method is unavailable in your country.');
  plan = localized;
  const g = await one<Gateway>("SELECT * FROM gateways WHERE id=$1", [
    provider,
  ]);
  if (!g?.enabled || !["stripe", "razorpay"].includes(provider))
    throw new Error("This payment gateway is not available.");
  let amount = minorAmount(period === 'yearly' ? plan.yearly_price : plan.price, plan.currency);
  if (coupon) {
    const c = await one<{ percent: number }>(
      "SELECT percent FROM coupons WHERE code=$1 AND active=true AND (expires IS NULL OR expires>now())",
      [coupon.toUpperCase()],
    );
    if (!c) throw new Error("This discount code is invalid or expired.");
    amount = Math.round(amount * (1 - c.percent / 100));
  }
  if (amount < minorAmount(1,plan.currency))
    throw new Error("Discounted total must be at least 1 currency unit.");
  const id = randomUUID(),
    base = process.env.APP_URL || origin;
  await query(
    "INSERT INTO payments(id,user_id,provider,plan_id,period,amount,currency,coupon,country) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [id, user.id, provider, plan.id, period, amount, plan.currency, coupon, country],
  );
  try {
    let result: { id: string; url?: string; short_url?: string };
    if (provider === "stripe") {
      const body = new URLSearchParams({
        mode: "payment",
        success_url: `${base}/payment/success/${id}`,
        cancel_url: `${base}/payment/cancel/${id}`,
        customer_email: user.email,
        client_reference_id: id,
        "metadata[payment_id]": id,
        "metadata[country]": country,
        billing_address_collection: 'required',
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": plan.currency.toLowerCase(),
        "line_items[0][price_data][unit_amount]": String(amount),
        "line_items[0][price_data][product_data][name]": `EXCPIX ${plan.name} - ${period} access`,
      });
      const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${decrypt(g.secret)}`,
          "Idempotency-Key": id,
        },
        body,
        signal: AbortSignal.timeout(15000),
      });
      result = await r.json();
      if (!r.ok)
        throw new Error(
          "Stripe could not create checkout. Check provider settings.",
        );
    } else {
      const r = await fetch("https://api.razorpay.com/v1/payment_links", {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(g.public_key + ":" + decrypt(g.secret)).toString(
              "base64",
            ),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          currency: plan.currency,
          description: `EXCPIX ${plan.name} - ${period}`,
          reference_id: id,
          customer: { name: user.name, email: user.email },
          callback_url: `${base}/payment/success/${id}`,
          callback_method: "get",
          notes: { payment_id: id, country },
        }),
        signal: AbortSignal.timeout(15000),
      });
      result = await r.json();
      if (!r.ok)
        throw new Error(
          "Razorpay could not create checkout. Check provider settings.",
        );
    }
    if (!result.id || !(result.url || result.short_url)?.startsWith('https://')) throw new Error('Payment provider returned an invalid checkout link.');
    await query("UPDATE payments SET provider_id=$1 WHERE id=$2", [
      result.id,
      id,
    ]);
    return { url: result.url || result.short_url, id };
  } catch (e) {
    await query("UPDATE payments SET status='failed' WHERE id=$1", [id]);
    throw e;
  }
}
export async function webhook(
  provider: string,
  raw: string,
  signature: string,
) {
  const g = await one<Gateway>("SELECT * FROM gateways WHERE id=$1", [
    provider,
  ]);
  if (!g?.webhook_secret) throw new Error("Webhook not configured");
  if (provider === "stripe") {
    const entries = signature.split(",").map((x) => x.split("="));
    const time = entries.find(([k]) => k === "t")?.[1] || "";
    const expected = createHmac("sha256", decrypt(g.webhook_secret))
      .update(time + "." + raw)
      .digest("hex");
    if (
      Math.abs(Date.now() / 1000 - Number(time)) > 300 ||
      !entries.some(([k, v]) => k === "v1" && safeEqual(v, expected))
    )
      throw new Error("Invalid webhook signature");
  } else if (provider === "razorpay") {
    if (
      !safeEqual(
        signature,
        createHmac("sha256", decrypt(g.webhook_secret))
          .update(raw)
          .digest("hex"),
      )
    )
      throw new Error("Invalid webhook signature");
  } else throw new Error("Unsupported webhook");
  const event = JSON.parse(raw);
  let ref: string | undefined,
    amount: number | undefined,
    currency: string | undefined,
    paid = false;
  if (provider === "stripe") {
    const s = event.data?.object;
    paid =
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type) && s?.payment_status === "paid";
    ref = s?.id;
    amount = s?.amount_total;
    currency = s?.currency;
  } else {
    const s = event.payload?.payment_link?.entity;
    paid = event.event === "payment_link.paid" && s?.status === "paid";
    ref = s?.id;
    amount = s?.amount_paid;
    currency = s?.currency;
  }
  if (!paid) return;
  const payment = await one<{ id: string; amount: number; currency: string }>(
    "SELECT id,amount,currency FROM payments WHERE provider=$1 AND provider_id=$2",
    [provider, ref],
  );
  if (
    !payment ||
    payment.amount !== amount ||
    payment.currency.toLowerCase() !== currency?.toLowerCase()
  )
    throw new Error("Payment verification mismatch");
  // The payment claim and entitlement update share a single SQL statement, including retries.
  await query(
    "WITH paid AS (UPDATE payments SET status='paid',paid_at=now() WHERE id=$1 AND status='pending' RETURNING user_id,plan_id,period) UPDATE users SET plan=paid.plan_id,plan_expires=greatest(coalesce(users.plan_expires,now()),now())+CASE WHEN paid.period='yearly' THEN interval '1 year' ELSE interval '1 month' END FROM paid WHERE users.id=paid.user_id",
    [payment.id],
  );
  await query(
    "INSERT INTO webhook_events(id,provider) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [event.id || provider + ":" + payment.id, provider],
  );
}
