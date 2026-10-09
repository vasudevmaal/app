"use client";
import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  CheckCircle,
  CreditCard,
  Download,
  Heart,
  Layers,
  LockKeyhole,
  Mail,
  Send,
  UserRound,
  Clock,
  Plus,
  Trash2,
  FolderOpen,
  LogOut,
  ShieldCheck,
  LoaderCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { useApp } from "./providers";
import { api, saveBlob } from "@/lib/client";
import { PinterestGrid, StyleCard } from "./gallery";
import { Preview } from "./preview";
import type { Plan, Style } from "@/lib/types";
import { glyphMap } from "@/lib/content";
import {
  countries,
  currencies,
  pricedPlan,
  paymentGateways,
  money,
  majorAmount,
} from "@/lib/billing";
function PasswordField({
  label,
  name,
  valueType,
  autoComplete,
  minLength,
  placeholder,
  visible,
  onToggle,
}: {
  label: string;
  name: string;
  valueType: "password" | "text";
  autoComplete: string;
  minLength?: number;
  placeholder?: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="password-control">
        <input
          name={name}
          type={valueType}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="password-toggle"
          title={visible ? "Hide password" : "Show password"}
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={onToggle}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}
export function Login({
  googleEnabled = false,
  turnstileSiteKey = "",
}: {
  googleEnabled?: boolean;
  turnstileSiteKey?: string;
}) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [turnstileToken, setTurnstileToken] = useState("");
  const router = useRouter();
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get(
      "oauth_error",
    );
    const messages: Record<string, string> = {
      cancelled: "Google sign-in was cancelled. Please try again.",
      missing_code:
        "Start sign-in using Continue with Google. Do not open the callback URL directly.",
      expired_state:
        "Your sign-in session expired. Please use Continue with Google again in this browser.",
      configuration:
        "The owner must configure a Google client ID and client secret.",
      credentials:
        "Google credentials could not be verified. The owner must save the matching client ID and client secret again.",
      expired_code:
        "This Google sign-in link expired or was already used. Please start sign-in again.",
      token: "Google could not complete sign-in. Please try again.",
      profile: "Google could not provide a verified email address.",
      blocked: "This account is blocked. Please contact support.",
      account: "Your account could not be created. Please try again.",
      unavailable:
        "Google sign-in is temporarily unavailable. Please try again.",
    };
    if (reason && messages[reason]) setError(messages[reason]);
  }, []);
  useEffect(() => {
    if (!turnstileSiteKey) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    (window as any).excpixTurnstile = (token: string) =>
      setTurnstileToken(token);
    return () => {
      script.remove();
    };
  }, [turnstileSiteKey]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api("auth/" + (register ? "register" : "login"), data);
      const me = await api("auth/me");
      window.location.href =
        me.user.role === "owner" ? "/owner" : "/user/" + me.user.username;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-art">
        <Preview
          state={{
            text: "MAKE\nIT YOURS",
            fontFamily: "Bungee",
            letterSpacing: 0,
            lineHeight: 1.12,
            align: "center",
            isBold: true,
            isItalic: false,
            isUnderline: false,
            rotation: -7,
            curve: 0,
            zigzag: 0,
            wave: 0,
            animation: { id: "float", speed: 0.7 },
            fill: {
              type: "gradient",
              color: "#fbd074",
              opacity: 1,
              angle: 90,
              stops: [
                { color: "#ffe9ae", pos: 0 },
                { color: "#fbb471", pos: 100 },
              ],
            },
            layers: [
              {
                id: 1,
                layerType: "3d",
                enabled: true,
                type: "solid",
                color: "#913d2b",
                opacity: 1,
                angle: 120,
                stops: [],
                size: 25,
                width: 0,
              },
            ],
            bg: {
              type: "solid",
              color: "#ed795f",
              opacity: 1,
              angle: 90,
              stops: [],
            },
          }}
          animated
        />
        <div>
          <span className="eyebrow">YOUR NEXT GREAT IDEA STARTS HERE</span>
          <p>A space for your most creative self.</p>
        </div>
      </div>
      <div className="auth-form-wrap">
        <span className="eyebrow">WELCOME TO EXCPIX</span>
        <h1>
          {register ? "Make room for creativity." : "Good to see you again."}
        </h1>
        <p>
          {register
            ? "Create your free account."
            : "Sign in to your creative workspace."}
        </p>
        {googleEnabled && (
          <>
            <a className="button full" href="/api/auth/google">
              <span className="google-letter">G</span>Continue with Google
            </a>
            <div className="or-divider">or with email</div>
          </>
        )}
        <form className="form-stack" onSubmit={submit}>
          {register && (
            <label className="field">
              <span>Your name</span>
              <input
                name="name"
                required
                minLength={2}
                autoComplete="name"
                placeholder="Alex Creative"
              />
            </label>
          )}
          <label className="field">
            <span>Email address</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </label>
          {turnstileSiteKey && (
            <>
              <div
                className="cf-turnstile"
                data-sitekey={turnstileSiteKey}
                data-callback="excpixTurnstile"
              />
              <input
                type="hidden"
                name="turnstile_token"
                value={turnstileToken}
              />
            </>
          )}
          <PasswordField
            label="Password"
            name="password"
            valueType={showPassword ? "text" : "password"}
            autoComplete={register ? "new-password" : "current-password"}
            minLength={8}
            placeholder="At least 8 characters"
            visible={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button dark full" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : null}
            {register ? "Create account" : "Sign in"}
            <ArrowUpRight size={17} />
          </button>
        </form>
        <p className="auth-switch">
          {register ? "Already have an account?" : "New to EXCPIX?"}{" "}
          <button
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register ? "Sign in" : "Create an account"}
          </button>
        </p>
        <small>
          By continuing, you agree to our <Link href="/term">Terms</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </small>
      </div>
    </main>
  );
}
export function Subscription({
  plans,
  gateways,
  initialCountry,
}: {
  plans: Plan[];
  gateways: { id: string }[];
  initialCountry: string;
}) {
  const { user, settings, toast } = useApp();
  const [country, setCountry] = useState(initialCountry);
  const currencyCountries: Record<string, string> = {
    INR: "IN",
    USD: "US",
    EUR: "DE",
    JPY: "JP",
    GBP: "GB",
    AUD: "AU",
    CAD: "CA",
    CHF: "CH",
    CNY: "CN",
    AED: "AE",
  };
  const selectedCurrency =
    countries.find((c) => c.code === country)?.currency || "USD";
  const [period, setPeriod] = useState(
      settings.billing_periods[0] || "monthly",
    ),
    [selected, setSelected] = useState<Plan | null>(null),
    [gateway, setGateway] = useState(gateways[0]?.id || ""),
    [coupon, setCoupon] = useState(""),
    [busy, setBusy] = useState(false);
  const localizedPlans = plans.map((p) => ({
    original: p,
    localized: pricedPlan(p, country),
  }));
  const selectedPrice = selected ? pricedPlan(selected, country) : null;
  const availableGateways = selected
    ? gateways.filter((g) => paymentGateways(selected, country).includes(g.id))
    : [];
  const selectedGateway = availableGateways.some((g) => g.id === gateway)
    ? gateway
    : availableGateways[0]?.id || "";
  async function pay() {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    if (!selected) return;
    setBusy(true);
    try {
      const r = await api("checkout", {
        plan: selected.id,
        period,
        provider: selectedGateway,
        coupon,
        country,
      });
      window.location.href = r.url;
    } catch (e) {
      toast((e as Error).message, true);
      setBusy(false);
    }
  }
  return (
    <main className="pricing-page main-width">
      <div className="pricing-heading">
        <span className="eyebrow">MORE ROOM TO CREATE</span>
        <h1>Your ideas. Without limits.</h1>
        <p>Pick the plan that fits your creative rhythm.</p>
        <label className="field billing-country">
          <span>Currency</span>
          <select
            value={selectedCurrency}
            onChange={(e) => {
              setCountry(currencyCountries[e.target.value] || "US");
              setSelected(null);
            }}
          >
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
        <div className="billing-tabs">
          {settings.billing_periods.map((p) => (
            <button
              key={p}
              className={period === p ? "active" : ""}
              onClick={() => setPeriod(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
              {p === "yearly" && <span>Best value</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="plans-grid">
        {localizedPlans
          .filter(({ original }) => original.active)
          .map(({ original, localized }) => {
            const p = localized || original;
            return (
              <article
                className={"plan " + (p.id === "pro" ? "featured" : "")}
                key={p.id}
              >
                {p.id === "pro" && (
                  <span className="popular-tag">THE CREATOR FAVORITE</span>
                )}
                <span className="plan-name">{p.name}</span>
                <div className="plan-price">
                  <strong>
                    {localized
                      ? money(
                          period === "yearly" ? p.yearly_price : p.price,
                          p.currency,
                        )
                      : "Unavailable"}
                  </strong>
                  <span>/{period === "yearly" ? "year" : "month"}</span>
                </div>
                <p>
                  {p.id === "free"
                    ? "For everyday inspiration."
                    : p.id === "pro"
                      ? "For ideas that deserve more."
                      : "For your next big creative chapter."}
                </p>
                <button
                  className={"button full " + (p.id === "pro" ? "accent" : "")}
                  disabled={
                    !localized || (user?.plan === p.id && p.id === "free")
                  }
                  onClick={() =>
                    p.id === "free"
                      ? (window.location.href = "/3d-text")
                      : setSelected(original)
                  }
                >
                  {p.id === "free" ? "Start creating" : "Choose " + p.name}
                  <ArrowUpRight size={16} />
                </button>
                <div className="control-divider" />
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>
                      <Check size={16} />
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
      </div>
      <div className="payment-note">
        <ShieldCheck size={18} />
        <span>
          Secure checkout · Receipt with every payment · Monthly or yearly
          access
        </span>
      </div>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Checkout"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-title">
              <h2>EXCPIX {selected.name}</h2>
              <button
                className="icon-button"
                title="Close checkout"
                onClick={() => setSelected(null)}
              >
                ×
              </button>
            </div>
            <p>
              {period} access ·{" "}
              {selectedPrice &&
                money(
                  period === "yearly"
                    ? selectedPrice.yearly_price
                    : selectedPrice.price,
                  selectedPrice.currency,
                )}
            </p>
            {availableGateways.length ? (
              <>
                <label className="field">
                  <span>Payment method</span>
                  <select
                    value={selectedGateway}
                    onChange={(e) => setGateway(e.target.value)}
                  >
                    {availableGateways.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.id === "razorpay"
                          ? selectedPrice?.currency === "INR"
                            ? "Razorpay · UPI, cards, netbanking"
                            : "Razorpay · international cards"
                          : "Stripe · cards and supported local methods"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Discount code</span>
                  <input
                    value={coupon}
                    onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                    placeholder="Optional"
                  />
                </label>
                <button
                  className="button accent full"
                  disabled={busy}
                  onClick={pay}
                >
                  {busy ? "Opening secure checkout..." : "Continue to payment"}
                  <CreditCard size={17} />
                </button>
                <small>
                  Access renews when you purchase another period. No automatic
                  charge.
                </small>
              </>
            ) : (
              <div className="empty compact">
                <CreditCard />
                <h3>Checkout is not available yet.</h3>
                <p>
                  Payment providers are being configured. No payment has been
                  taken.
                </p>
                <Link className="button" href="/contact">
                  Contact support
                </Link>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
export function Contact() {
  const { user, toast } = useApp();
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  return (
    <main className="contact-page main-width">
      <div>
        <span className="eyebrow">LET'S TALK</span>
        <h1>
          A question, an idea,
          <br />
          or a little help?
        </h1>
        <p>Send a note to the EXCPIX team.</p>
        <div className="contact-meta">
          <Mail size={20} />
          <div>
            <strong>We're here for you.</strong>
            <span>Account, payments, styles and everything in between.</span>
          </div>
        </div>
      </div>
      {done ? (
        <div className="empty">
          <CheckCircle size={40} />
          <h2>Message received.</h2>
          <p>Your support request has been saved.</p>
          <button className="button" onClick={() => setDone(false)}>
            Send another message
          </button>
        </div>
      ) : (
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(
                "contact",
                Object.fromEntries(new FormData(e.currentTarget)),
              );
              setDone(true);
            } catch (e) {
              toast((e as Error).message, true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="two-fields">
            <label className="field">
              <span>Name</span>
              <input
                name="name"
                defaultValue={user?.name}
                minLength={2}
                required
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                defaultValue={user?.email}
                required
              />
            </label>
          </div>
          <label className="field">
            <span>Subject</span>
            <input name="subject" required minLength={3} />
          </label>
          <label className="field">
            <span>Your message</span>
            <textarea name="message" rows={7} required minLength={10} />
          </label>
          <button className="button accent" disabled={busy}>
            {busy ? "Sending..." : "Send message"}
            <Send size={16} />
          </button>
        </form>
      )}
    </main>
  );
}
export function UserPanel() {
  const { user, toast } = useApp();
  const [tab, setTab] = useState("saved"),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [showCurrentPassword, setShowCurrentPassword] = useState(false),
    [showNewPassword, setShowNewPassword] = useState(false);
  useEffect(() => {
    api("account")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  if (!user)
    return (
      <main className="empty">
        <h1>Your creative workspace</h1>
        <Link className="button dark" href="/login">
          Sign in
        </Link>
      </main>
    );
  return (
    <main className="workspace-page main-width">
      <div className="workspace-heading">
        <div className="large-avatar">{user.name[0]}</div>
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>{user.name}</h1>
          <p>
            @{user.username} <span className="badge">{user.plan}</span>
          </p>
        </div>
        <Link className="button dark" href="/3d-text/sunset-pop">
          <Plus size={16} />
          New creation
        </Link>
      </div>
      <div className="workspace-tabs">
        {[
          { id: "saved", label: "Saved styles", icon: Heart },
          { id: "projects", label: "My projects", icon: FolderOpen },
          { id: "downloads", label: "Downloads", icon: Download },
          { id: "billing", label: "Billing", icon: CreditCard },
          { id: "settings", label: "Account", icon: UserRound },
        ].map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>
      {error ? (
        <p className="form-error">{error}</p>
      ) : !data ? (
        <div className="empty">Loading your workspace...</div>
      ) : (
        <>
          {tab === "saved" &&
            (data.favorites.length ? (
              <PinterestGrid>
                {data.favorites.map((s: Style) => (
                  <StyleCard key={s.id} style={s} initialSaved />
                ))}
              </PinterestGrid>
            ) : (
              <Empty
                title="Your next favorite is out there."
                text="Save a style and find it here."
                href="/"
                action="Explore styles"
              />
            ))}
          {tab === "projects" &&
            (data.projects.length ? (
              <PinterestGrid>
                {data.projects.map((p: any) => (
                  <article className="style-card" key={p.id}>
                    <div className="style-image">
                      {p.content_json.tool === "3d-text" ? (
                        <img
                          src={p.content_json.thumbnail}
                          alt={p.title}
                          loading="lazy"
                        />
                      ) : (
                        <Preview
                          state={p.content_json}
                          glyphs={
                            p.kind === "ai" ||
                            (p.kind === "text" &&
                              p.metadata?.source_kind === "ai")
                              ? glyphMap(p)
                              : undefined
                          }
                        />
                      )}
                    </div>
                    <div className="style-caption">
                      <div>
                        <h3>{p.title}</h3>
                        <small>
                          {new Date(p.updated_at).toLocaleDateString()}
                        </small>
                      </div>
                      <button
                        title="Open project"
                        className="icon-button"
                        onClick={() => {
                          if (p.content_json.tool === "3d-text") {
                            sessionStorage.setItem(
                              "excpix-text3d-project-load",
                              JSON.stringify({
                                id: p.id,
                                project: p.content_json,
                              }),
                            );
                            window.location.href = "/3d-studio/3d-text";
                            return;
                          }
                          sessionStorage.setItem(
                            "excpix-project-load",
                            JSON.stringify(p.content_json),
                          );
                          const kind = p.kind || "3d-text";
                          const slug = p.slug || "sunset-pop";
                          window.location.href = `/${kind}/${slug}`;
                        }}
                      >
                        <FolderOpen size={18} />
                      </button>
                      <button
                        title="Delete project"
                        className="icon-button danger"
                        onClick={async () => {
                          if (confirm("Delete this saved project?")) {
                            await api("projects", { id: p.id }, "DELETE");
                            setData({
                              ...data,
                              projects: data.projects.filter(
                                (x: any) => x.id !== p.id,
                              ),
                            });
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </PinterestGrid>
            ) : (
              <Empty
                title="A blank canvas. A fresh start."
                text="Your saved projects will appear here."
                href="/3d-text/sunset-pop"
                action="Create text"
              />
            ))}
          {tab === "downloads" && (
            <>
              <p className="muted">{data.used} downloads today</p>
              {data.downloads.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Style</th>
                        <th>Format</th>
                        <th>Resolution</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.downloads.map((d: any) => (
                        <tr key={d.id}>
                          <td>{d.title}</td>
                          <td>{d.format.toUpperCase()}</td>
                          <td>{d.quality}px</td>
                          <td>{new Date(d.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Your downloads live here."
                  text="Create and download your first design."
                />
              )}
            </>
          )}
          {tab === "billing" && (
            <>
              <div className="billing-summary">
                <div>
                  <span className="eyebrow">CURRENT PLAN</span>
                  <h2>{user.plan.toUpperCase()}</h2>
                  <p>
                    {user.plan_expires
                      ? "Access until " +
                        new Date(user.plan_expires).toLocaleDateString()
                      : "Free access"}
                  </p>
                </div>
                {user.plan === "free" && (
                  <Link className="button accent" href="/pricing">
                    Manage plan <ArrowUpRight size={16} />
                  </Link>
                )}
              </div>
              {data.payments.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Plan</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payments.map((p: any) => (
                        <tr key={p.id}>
                          <td>{p.plan_id}</td>
                          <td>
                            {money(
                              majorAmount(p.amount, p.currency),
                              p.currency,
                            )}
                          </td>
                          <td>
                            <span className={"badge " + p.status}>
                              {p.status}
                            </span>
                          </td>
                          <td>
                            {p.status === "paid" ? (
                              <a
                                title="Download receipt"
                                href={"/api/receipt/" + p.id}
                              >
                                <Download size={17} />
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">No payments yet.</p>
              )}
            </>
          )}
          {tab === "settings" && (
            <div className="account-settings">
              <h2>Account details</h2>
              <p>{user.email}</p>
              <h3>Change password</h3>
              <form
                className="form-stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  try {
                    await api(
                      "account/password",
                      Object.fromEntries(new FormData(form)),
                    );
                    form.reset();
                    toast(
                      "Password updated. Other sessions have been signed out.",
                    );
                  } catch (e) {
                    toast((e as Error).message, true);
                  }
                }}
              >
                <PasswordField
                  label="Current password"
                  name="current"
                  valueType={showCurrentPassword ? "text" : "password"}
                  autoComplete="current-password"
                  visible={showCurrentPassword}
                  onToggle={() => setShowCurrentPassword((value) => !value)}
                />
                <PasswordField
                  label="New password"
                  name="password"
                  valueType={showNewPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  visible={showNewPassword}
                  onToggle={() => setShowNewPassword((value) => !value)}
                />
                <button className="button dark">
                  <LockKeyhole size={16} />
                  Update password
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </main>
  );
}
function Empty({
  title,
  text,
  href,
  action,
}: {
  title: string;
  text: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="empty">
      <Layers size={32} />
      <h2>{title}</h2>
      <p>{text}</p>
      {href && (
        <Link className="button" href={href}>
          {action}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function PaymentResult({
  payment,
  cancelled,
}: {
  payment: any;
  cancelled: boolean;
}) {
  return (
    <main className="empty payment-result">
      {payment.status === "paid" ? (
        <CheckCircle size={48} />
      ) : (
        <Clock size={48} />
      )}
      <h1>
        {payment.status === "paid"
          ? "You are all set."
          : cancelled
            ? "Checkout cancelled."
            : "Confirming your payment."}
      </h1>
      <p>
        {payment.status === "paid"
          ? `Your ${payment.plan_id} access is active.`
          : cancelled
            ? "No access has been activated. You can try checkout again."
            : "Access is activated only after verified payment confirmation. Please refresh in a moment."}
      </p>
      <div className="two-fields">
        {payment.status === "paid" && (
          <a href={"/api/receipt/" + payment.id} className="button accent">
            <Download size={17} />
            Download receipt
          </a>
        )}
        <Link href="/pricing" className="button">
          View plans
        </Link>
        {!cancelled && payment.status !== "paid" && (
          <button className="button" onClick={() => window.location.reload()}>
            Refresh status
          </button>
        )}
      </div>
    </main>
  );
}
