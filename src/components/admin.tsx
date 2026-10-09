"use client";
import { useEffect, useState, useRef, FormEvent } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Layers,
  FileText,
  Settings,
  CreditCard,
  Tag,
  ShieldCheck,
  Activity,
  LifeBuoy,
  Server,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownToLine,
  ChevronRight,
  Check,
  X,
  Pencil,
  RefreshCw,
  Globe,
  LogOut,
  ChevronDown,
  Eye,
  Database,
  Clock,
  TrendingUp,
  Download,
  Menu,
  Save,
  LockKeyhole,
  ImageIcon,
  Trash2,
  Upload,
} from "lucide-react";
import { api } from "@/lib/client";
import { useApp } from "./providers";
import { defaultState } from "@/lib/defaults";
import { defaultText3D } from "@/lib/text3d";
import { defaultButtonState } from "@/lib/button";
import { Preview } from "./preview";
import { StyleThumbnail } from "./style-thumbnail";
import { CollectionFields, MetadataFields } from "./admin-content";
import { RegionalPrices } from "./regional-prices";
import { PresetManager } from "./presets";
import { currencies, majorAmount, money } from "@/lib/billing";
const sections = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    permission: "analytics",
    group: "WORKSPACE",
  },
  {
    id: "styles",
    label: "Content library",
    icon: Layers,
    permission: "content",
  },
  { id: "users", label: "Users & access", icon: Users, permission: "users" },
  {
    id: "creative-library",
    label: "Creative library",
    icon: ImageIcon,
    permission: "owner",
  },
  { id: "pages", label: "Pages & SEO", icon: FileText, permission: "pages" },
  {
    id: "plans",
    label: "Pricing plans",
    icon: CreditCard,
    permission: "plans",
    group: "BUSINESS",
  },
  {
    id: "payments",
    label: "Transactions",
    icon: ArrowDownToLine,
    permission: "payments",
  },
  { id: "coupons", label: "Discount codes", icon: Tag, permission: "coupons" },
  { id: "gateways", label: "Integrations", icon: Globe, permission: "owner" },
  {
    id: "tickets",
    label: "Support inbox",
    icon: LifeBuoy,
    permission: "support",
    group: "MANAGEMENT",
  },
  { id: "audit", label: "Activity log", icon: Activity, permission: "audit" },
  { id: "system", label: "System health", icon: Server, permission: "system" },
  {
    id: "settings",
    label: "Site settings",
    icon: Settings,
    permission: "settings",
  },
];
const blankStyle = {
  title: "",
  slug: "",
  kind: "3d-text",
  description: "",
  seo_title: "",
  seo_description: "",
  seo_keywords: [],
  image_url: "",
  image_alt: "",
  style_category: "",
  tags: [],
  metadata: {},
  content_json: defaultState,
  is_free: true,
  is_premium: false,
  is_active: true,
  is_locked: false,
  badge: "",
  status: "approved",
};
function titleToSlug(value?: string) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}
function default3DProject() {
  return {
    tool: "3d-text",
    version: 1,
    state: structuredClone(defaultText3D),
  };
}
const contentKinds = [
  { id: "all", label: "All collections" },
  { id: "3d-text", label: "3D Text" },
  { id: "ai", label: "AI Design" },
  { id: "design", label: "Design" },
  { id: "3d", label: "3D" },
  { id: "text", label: "Text" },
  { id: "visual", label: "Visual" },
  { id: "button", label: "Button" },
];
function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  row.push(cell);
  rows.push(row);
  const [header = [], ...body] = rows.filter((r) => r.some((c) => c.trim()));
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((r) =>
    Object.fromEntries(keys.map((key, i) => [key, (r[i] || "").trim()])),
  );
}
function csvStyle(row: Record<string, string>, fallbackKind: string) {
  const kind = row.kind || (fallbackKind === "all" ? "text" : fallbackKind);
  const title = row.title || row.text || row.slug || "Untitled";
  const slug =
    row.slug ||
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) ||
    "untitled";
  const content = structuredClone(defaultState);
  content.text = row.text || title;
  return {
    ...blankStyle,
    kind,
    title,
    slug,
    description: row.description || "",
    seo_title: row.seo_title || row.seo || "",
    seo_description: row.seo_description || "",
    seo_keywords: (row.seo_keywords || row.keywords || "")
      .split(/[|,]/)
      .map((s) => s.trim())
      .filter(Boolean),
    image_url: row.image_url || "",
    image_alt: row.image_alt || title,
    style_category: row.style_category || row.category || "",
    tags: (row.tags || row.tag || "")
      .split(/[|,]/)
      .map((s) => s.trim())
      .filter(Boolean),
    badge: row.badge || row.image_badge || "",
    is_premium: ["true", "1", "yes", "premium"].includes(
      (row.is_premium || row.access || "").toLowerCase(),
    ),
    is_free: !["true", "1", "yes", "premium"].includes(
      (row.is_premium || row.access || "").toLowerCase(),
    ),
    is_active: row.is_active
      ? !["false", "0", "draft"].includes(row.is_active.toLowerCase())
      : true,
    is_locked: ["true", "1", "yes"].includes(row.is_locked?.toLowerCase()),
    status: ["pending", "rejected"].includes(row.status)
      ? row.status
      : "approved",
    content_json: row.content_json ? JSON.parse(row.content_json) : content,
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
  };
}
function collectionOptions(settings: any) {
  const map = new Map(
    contentKinds.filter((c) => c.id !== "all").map((c) => [c.id, c.label]),
  );
  for (const c of settings.categories || []) map.set(c.id, c.name);
  return [...map].map(([id, label]) => ({ id, label }));
}
export function Admin() {
  const { user, settings, toast } = useApp();
  const available = sections.filter(
    (s) => user?.role === "owner" || user?.permissions.includes(s.permission),
  );
  const [section, setSection] = useState(available[0]?.id || "overview"),
    [data, setData] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [kindFilter, setKindFilter] = useState("all"),
    [filter, setFilter] = useState("all"),
    [pageSize, setPageSize] = useState(50),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<any>(null),
    [downloadView, setDownloadView] = useState<{name: string; items: string[]} | null>(null),
    [saving, setSaving] = useState(false),
    [mobile, setMobile] = useState(false);
  const [billingSaving, setBillingSaving] = useState(false);
  const requestId = useRef(0);
  const [loadedSection, setLoadedSection] = useState("");
  async function load() {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      let path =
        section === "creative-library"
          ? "creative-library"
          : "admin/" + section;
      if (section === "styles") {
        const params = new URLSearchParams({
          limit: String(pageSize),
          offset: String((page - 1) * pageSize),
        });
        if (search.trim()) params.set("term", search.trim());
        if (kindFilter !== "all") params.set("kind", kindFilter);
        if (filter !== "all") params.set("status", filter);
        path += "?" + params.toString();
      }
      const result = await api(path);
      if (id === requestId.current) {
        setData(result);
        setLoadedSection(section);
      }
    } catch (e) {
      if (id === requestId.current) setError((e as Error).message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }
  useEffect(() => {
    setSearch("");
    setKindFilter("all");
    setFilter("all");
    setPage(1);
    setData(null);
  }, [section]);
  useEffect(() => {
    load();
    return () => {
      requestId.current++;
    };
  }, [section, page, pageSize, kindFilter, filter, search]);
  async function save(value: any) {
    setSaving(true);
    try {
      await api("admin/" + section, value);
      setEdit(null);
      toast("Changes saved.");
      await load();
      if (section === "settings") window.location.reload();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setSaving(false);
    }
  }
  async function saveBillingPeriods(periods: string[]) {
    setBillingSaving(true);
    try {
      await api("admin/settings", { billing_periods: periods });
      toast("Billing tabs updated.");
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBillingSaving(false);
    }
  }
  async function deleteContent(row: any) {
    if (
      !window.confirm(
        `Delete "${row.title}"? Its public page and favorites will be removed. Saved projects and download history will remain. This cannot be undone.`,
      )
    )
      return;
    setSaving(true);
    try {
      await api("admin/styles", { id: row.id }, "DELETE");
      toast("Content deleted.");
      await load();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setSaving(false);
    }
  }
  async function viewDownloads(id: string, name: string) {
    try {
      const rows = await api("admin/user-downloads?user_id=" + encodeURIComponent(id));
      setDownloadView({ name, items: rows.map((row: { item_name: string }) => row.item_name) });
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  async function downloadAllDownloads() {
    try {
      const rows = await api("admin/user-downloads");
      const text = rows.length
        ? rows.map((row: { user_name: string; item_name: string }) => `${row.user_name}\t${row.item_name}`).join("\n")
        : "No downloads found.";
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "excpix-downloads.txt";
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  async function uploadCsv(file: File) {
    if (user?.role !== "owner") {
      toast("Only the owner can upload CSV content.", true);
      return;
    }
    setSaving(true);
    try {
      const items = parseCsv(await file.text()).map((row) =>
        csvStyle(row, kindFilter),
      );
      if (!items.length) throw new Error("CSV has no content rows.");
      for (const item of items) await api("admin/styles", item);
      toast(`${items.length} content items uploaded.`);
      await load();
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setSaving(false);
    }
  }
  const title = sections.find((s) => s.id === section)?.label;
  const styleData =
    section === "styles" && data && !Array.isArray(data) ? data : null;
  const sourceRows = styleData ? styleData.items : data;
  const rows = Array.isArray(sourceRows)
    ? section === "styles"
      ? sourceRows
      : sourceRows.filter(
          (r) =>
            JSON.stringify(r).toLowerCase().includes(search.toLowerCase()) &&
            (kindFilter === "all" || r.kind === kindFilter) &&
            (filter === "all" || r.status === filter),
        )
    : [];
  const totalRows = Number(styleData?.total || rows.length);
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pageStart = totalRows ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(page * pageSize, totalRows);
  useEffect(() => {
    if (section === "styles" && page > totalPages) setPage(totalPages);
  }, [section, page, totalPages]);
  function add() {
    if (section === "styles") setEdit(structuredClone(blankStyle));
    if (section === "pages")
      setEdit({
        slug: "",
        title: "",
        content: "",
        seo_title: "",
        seo_description: "",
        route_prefix: "p",
        is_active: true,
      });
    if (section === "plans")
      setEdit({
        id: "",
        name: "",
        price: 0,
        yearly_price: 0,
        currency: "INR",
        download_limit: 10,
        max_quality: 1280,
        features: [],
        active: true,
      });
    if (section === "coupons")
      setEdit({ code: "", percent: 10, expires: "", active: true });
  }
  return (
    <div className="admin-shell">
      <aside className={"admin-sidebar " + (mobile ? "open" : "")}>
        <div className="admin-identity">
          <span className="owner-icon">
            <ShieldCheck size={21} />
          </span>
          <div>
            <strong>EXCPIX Studio</strong>
            <span>
              {user?.role === "owner" ? "Owner workspace" : "Team workspace"}
            </span>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav>
          {available.map((s) => (
            <div key={s.id}>
              {s.group && <span className="nav-group">{s.group}</span>}
              <button
                className={section === s.id ? "active" : ""}
                onClick={() => {
                  setSection(s.id);
                  setMobile(false);
                }}
              >
                <s.icon size={18} />
                {s.label}
                {section === s.id && <span className="nav-active-mark" />}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/">
            View website <ArrowUpRight size={15} />
          </Link>
          <div className="sidebar-user">
            <span className="avatar">{user?.name[0]}</span>
            <span>
              <strong>{user?.name}</strong>
              <small>{user?.role}</small>
            </span>
            <button
              title="Sign out"
              className="icon-button"
              onClick={async () => {
                await api("auth/logout", {});
                window.location.href = "/";
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-topbar">
          <div>
            <button
              title="Open panel menu"
              className="icon-button admin-mobile-menu"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={18} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <span>
            <Clock size={14} />
            {new Date().toLocaleDateString("en", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
        <div className="admin-content">
          <div className="admin-heading">
            <div>
              <span className="eyebrow">
              {section === "overview"
                  ? "YOUR CREATIVE BUSINESS"
                  : user?.role?.toUpperCase() + " WORKSPACE"}
              </span>
              <h1>
                {section === "overview" ? "A clear view of everything." : title}
              </h1>
              <p>
                {
                  (
                    {
                      overview:
                        "Welcome back. Here is what is happening at EXCPIX.",
                      styles:
                        "Manage styles, review submissions and keep your collection fresh.",
                      users: "People, permissions and workspace access.",
                      pages: "Your pages, your words, your search presence.",
                      plans: "Plan pricing, quality limits and access.",
                      gateways: "Payment providers and sign-in connections.",
                      system: "Live resource usage for this server.",
                      settings: "Make EXCPIX feel like your own.",
                      "user-downloads": "",
                    } as Record<string, string>
                  )[section]
                }
              </p>
            </div>
            <div className="toolbar-actions">
              <button className="button" onClick={load}>
                <RefreshCw size={15} />
                Refresh
              </button>
              {["styles", "pages", "plans", "coupons"].includes(section) && (
                <button className="button dark" onClick={add}>
                  <Plus size={16} />
                  Add{" "}
                  {section === "styles"
                    ? "style"
                    : section === "pages"
                      ? "page"
                      : section === "plans"
                        ? "plan"
                        : "code"}
                </button>
              )}
            </div>
          </div>
          {error ? (
            <div className="form-error">{error}</div>
          ) : loading || loadedSection !== section ? (
            <div className="loading-grid">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : (
            <>
              {section === "overview" && data && (
                <>
                  <div className="stats-grid">
                    {[
                      {
                        label: "Total members",
                        value: data.counts.users,
                        icon: Users,
                      },
                      {
                        label: "Published & draft styles",
                        value: data.counts.styles,
                        icon: Layers,
                      },
                      {
                        label: "Total downloads",
                        value: data.counts.downloads,
                        icon: Download,
                      },
                      {
                        label: "Revenue received",
                        value: data.revenue_by_currency?.length
                          ? data.revenue_by_currency
                              .map((r: { amount: string; currency: string }) =>
                                money(
                                  majorAmount(Number(r.amount), r.currency),
                                  r.currency,
                                ),
                              )
                              .join(" / ")
                          : "0",
                        icon: CreditCard,
                      },
                    ].map((s) => (
                      <div className="stat" key={s.label}>
                        <div>
                          <span>{s.label}</span>
                          <s.icon size={18} />
                        </div>
                        <strong
                          className={
                            s.label === "Revenue received"
                              ? "revenue-total"
                              : ""
                          }
                        >
                          {s.value}
                        </strong>
                        <small>All time</small>
                      </div>
                    ))}
                  </div>
                  <div className="overview-split">
                    <section className="analytics-section">
                      <div className="section-title">
                        <div>
                          <h2>Download activity</h2>
                          <p>Last 14 days</p>
                        </div>
                        <span className="badge">Daily</span>
                      </div>
                      <div className="chart">
                        {Array.from({ length: 14 }, (_, i) => {
                          const date = new Date();
                          date.setDate(date.getDate() - 13 + i);
                          const key = date.toISOString().slice(0, 10),
                            v =
                              data.daily.find((r: any) => r.day === key)
                                ?.downloads || 0;
                          const max = Math.max(
                            1,
                            ...data.daily.map((r: any) => r.downloads),
                          );
                          return (
                            <div
                              className="chart-column"
                              key={i}
                              title={`${key}: ${v} downloads`}
                            >
                              <span>{v || ""}</span>
                              <div
                                style={{ height: Math.max(2, (v / max) * 140) }}
                              />
                              <small>{date.getDate()}</small>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                    <section className="review-section">
                      <span className="eyebrow">CONTENT REVIEW</span>
                      <div className="review-count">{data.counts.pending}</div>
                      <h2>Ideas waiting to go live.</h2>
                      <p>
                        Review community styles before they join the collection.
                      </p>
                      <button
                        className="button"
                        onClick={() => {
                          setSection("styles");
                          setFilter("pending");
                        }}
                      >
                        Review submissions
                        <ArrowUpRight size={16} />
                      </button>
                    </section>
                  </div>
                  <section className="activity-section">
                    <div className="section-title">
                      <h2>Recent activity</h2>
                      <button
                        className="text-button"
                        onClick={() => setSection("audit")}
                      >
                        View activity log <ArrowUpRight size={15} />
                      </button>
                    </div>
                    {data.activity.length ? (
                      data.activity.map((a: any) => (
                        <div className="activity-row" key={a.id}>
                          <span className="activity-icon">
                            <Activity size={16} />
                          </span>
                          <div>
                            <strong>{a.detail}</strong>
                            <p>
                              {a.actor_name} · {a.action}
                            </p>
                          </div>
                          <small>
                            {new Date(a.created_at).toLocaleString()}
                          </small>
                        </div>
                      ))
                    ) : (
                      <div className="empty compact">
                        <Activity size={28} />
                        <p>Workspace changes will appear here.</p>
                      </div>
                    )}
                  </section>
                </>
              )}
              {section === "creative-library" && <PresetManager />}
              {(Array.isArray(sourceRows) || section === "styles") &&
                section !== "creative-library" && (
                  <>
                    {!["plans", "gateways"].includes(section) && (
                      <div className="table-toolbar">
                        <div className="table-filter">
                          {section === "styles" ? (
                            <>
                              <div
                                className="collection-filter-row"
                                role="group"
                                aria-label="Content collections"
                              >
                                {contentKinds.map((v) => (
                                  <button
                                    key={v.id}
                                    className={
                                      kindFilter === v.id ? "active" : ""
                                    }
                                    onClick={() => {
                                      setKindFilter(v.id);
                                      setPage(1);
                                    }}
                                  >
                                    {v.label}
                                  </button>
                                ))}
                              </div>
                              <div
                                className="status-filter-row"
                                role="group"
                                aria-label="Review status"
                              >
                                {["all", "approved", "pending", "rejected"].map(
                                  (v) => (
                                    <button
                                      key={v}
                                      className={filter === v ? "active" : ""}
                                      onClick={() => {
                                        setFilter(v);
                                        setPage(1);
                                      }}
                                    >
                                      {v.charAt(0).toUpperCase() + v.slice(1)}
                                    </button>
                                  ),
                                )}
                              </div>
                            </>
                          ) : (
                            <strong>
                              {rows.length}{" "}
                              {section === "users" ? "members" : "records"}
                            </strong>
                          )}
                        </div>
                        <div className="table-search-stack">
                          <label className="table-search">
                            <Search size={16} />
                            <input
                              aria-label={"Filter " + section}
                              value={search}
                              onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                              }}
                              placeholder={"Filter " + section + "..."}
                            />
                          </label>
              {section === "users" && user?.role === "owner" && (
                <button className="button" onClick={downloadAllDownloads}>
                  <Download size={15} />
                  Download all TXT
                </button>
              )}
              {section === "styles" && user?.role === "owner" && (
                            <label className="button csv-upload">
                              <Upload size={15} />
                              CSV upload
                              <input
                                type="file"
                                accept=".csv,text/csv"
                                disabled={saving}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  e.currentTarget.value = "";
                                  if (file) uploadCsv(file);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                    {section === "styles" && (
                      <>
                        <div className="content-pager">
                          <span>
                            Showing {pageStart}-{pageEnd} of {totalRows}
                          </span>
                          <label>
                            Per page
                            <select
                              value={pageSize}
                              onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setPage(1);
                              }}
                            >
                              {[50, 100, 1000].map((size) => (
                                <option key={size} value={size}>
                                  {size}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            className="button small"
                            disabled={page <= 1}
                            onClick={() =>
                              setPage((value) => Math.max(1, value - 1))
                            }
                          >
                            Previous
                          </button>
                          <button
                            className="button small"
                            disabled={page >= totalPages}
                            onClick={() =>
                              setPage((value) =>
                                Math.min(totalPages, value + 1),
                              )
                            }
                          >
                            Next
                          </button>
                        </div>
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Style</th>
                                <th>Collection</th>
                                <th>Access</th>
                                <th>Status</th>
                                <th>Downloads</th>
                                {user?.role === "owner" && <th>Views</th>}
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((r) => (
                                <tr key={r.id}>
                                  <td>
                                    <div className="table-style">
                                      <div className="table-thumb">
                                        <StyleThumbnail style={r} />
                                      </div>
                                      <div>
                                        <strong>{r.title}</strong>
                                        <small>
                                          /{r.kind}/{r.slug}
                                        </small>
                                      </div>
                                    </div>
                                  </td>
                                  <td>{r.kind}</td>
                                  <td>
                                    <span
                                      className={
                                        "badge " +
                                        (r.is_premium ? "premium" : "")
                                      }
                                    >
                                      {r.is_premium ? "Premium" : "Free"}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={"badge " + r.status}>
                                      {!r.is_active && r.status === "approved"
                                        ? "Draft"
                                        : r.status}
                                    </span>
                                  </td>
                                  <td>{r.download_count}</td>
                                  {user?.role === "owner" && <td>{r.view_count || 0}</td>}
                                  <td>
                                    <button
                                      className="icon-button"
                                      title={"Edit " + r.title}
                                      onClick={() => setEdit(r)}
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      className="icon-button danger"
                                      title={"Delete " + r.title}
                                      disabled={saving}
                                      onClick={() => deleteContent(r)}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                    {section === "users" && (
                      <div className="table-wrap">
                        <table className="users-access-table">
                          <thead>
                            <tr>
                              <th>Member</th>
                              <th>Role</th>
                              <th>Plan</th>
                              <th>Access</th>
                              <th>Joined</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r.id}>
                                <td>
                                  <strong>{r.name}</strong>
                                  <small>{r.email}</small>
                                </td>
                                <td>
                                  <span className="badge">{r.role}</span>
                                </td>
                                <td>{r.plan}</td>
                                <td>
                                  <span
                                    className={
                                      "badge " +
                                      (r.active ? "approved" : "rejected")
                                    }
                                  >
                                    {r.active ? "Active" : "Suspended"}
                                  </span>
                                </td>
                                <td>
                                  {new Date(r.created_at).toLocaleDateString()}
                                </td>
                                <td className="user-actions-cell">
                                  {r.role !== "owner" &&
                                    user?.role === "owner" && (
                                      <div className="user-action-buttons">
                                        <button
                                          title={"View downloads by " + r.name}
                                          className="icon-button"
                                          onClick={() => viewDownloads(r.id, r.name)}
                                        >
                                          <Download size={16} />
                                        </button>
                                        <button
                                          title={"Edit " + r.name}
                                          className="icon-button"
                                          onClick={() => setEdit(r)}
                                        >
                                          <Pencil size={16} />
                                        </button>
                                        <button
                                          title={"Delete " + r.name}
                                          className="icon-button danger"
                                          onClick={async () => {
                                            if (
                                              !window.confirm(
                                                `Delete ${r.name}'s account?`,
                                              )
                                            )
                                              return;
                                            try {
                                              await api(
                                                "admin/users",
                                                { id: r.id },
                                                "DELETE",
                                              );
                                              toast("User deleted.");
                                              await load();
                                            } catch (e) {
                                              toast((e as Error).message, true);
                                            }
                                          }}
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {section === "pages" && (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Page</th>
                              <th>URL</th>
                              <th>Visibility</th>
                              <th>Updated</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r.slug}>
                                <td>
                                  <strong>{r.title}</strong>
                                  <small>
                                    {r.seo_title || "Default SEO title"}
                                  </small>
                                </td>
                                <td>
                                  <Link href={(r.route_prefix === "direct" ? "/" : "/p/") + r.slug}>
                                    {r.route_prefix === "direct" ? "/" : "/p/"}{r.slug}
                                  </Link>
                                </td>
                                <td>
                                  <span
                                    className={
                                      "badge " + (r.is_active ? "approved" : "")
                                    }
                                  >
                                    {r.is_active ? "Published" : "Draft"}
                                  </span>
                                </td>
                                <td>
                                  {new Date(r.updated_at).toLocaleDateString()}
                                </td>
                                <td>
                                  <button
                                    className="icon-button"
                                    title={"Edit " + r.title}
                                    onClick={() => setEdit(r)}
                                  >
                                    <Pencil size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {section === "plans" && (
                      <>
                        <div className="settings-form" style={{ marginBottom: 24 }}>
                          <span className="field-label">Billing tabs</span>
                          <div className="status-filter-row">
                            {["monthly", "yearly"].map((period) => {
                              const active = settings.billing_periods.includes(period);
                              const next = active
                                ? settings.billing_periods.filter((x) => x !== period)
                                : [...settings.billing_periods, period];
                              return (
                                <button
                                  type="button"
                                  key={period}
                                  className={active ? "active" : ""}
                                  disabled={billingSaving || (active && settings.billing_periods.length === 1)}
                                  onClick={() => saveBillingPeriods(next)}
                                >
                                  {period.charAt(0).toUpperCase() + period.slice(1)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="admin-plan-grid">
                          {data.map((r: any) => (
                            <article className="admin-plan" key={r.id}>
                            <div className="section-title">
                              <span className="badge">
                                {r.active ? "Active" : "Hidden"}
                              </span>
                              <button
                                className="icon-button"
                                title={"Edit " + r.name}
                                onClick={() => setEdit(r)}
                              >
                                <Pencil size={17} />
                              </button>
                            </div>
                            <h2>{r.name}</h2>
                            <strong className="admin-plan-price">
                              {r.currency} {r.price}
                              <small>/month</small>
                            </strong>
                            <p>{r.download_limit} downloads / day</p>
                            <p>{r.max_quality}px maximum</p>
                            <ul>
                              {r.features.map((f: string) => (
                                <li key={f}>
                                  <Check size={14} />
                                  {f}
                                </li>
                              ))}
                            </ul>
                            </article>
                          ))}
                        </div>
                      </>
                    )}
                    {section === "gateways" && (
                      <>
                        <div className="integration-grid">
                          {data.map((g: any) => (
                            <article className="integration" key={g.id}>
                              <div className="integration-logo">
                                {g.id[0].toUpperCase()}
                              </div>
                              <div>
                                <h3>
                                  {g.id === "google"
                                    ? "Google sign-in"
                                    : g.id === "turnstile"
                                      ? "Cloudflare Turnstile"
                                      : g.id.charAt(0).toUpperCase() +
                                        g.id.slice(1)}
                                </h3>
                                <p>
                                  {g.id === "turnstile"
                                    ? "Bot protection"
                                    : g.id === "razorpay"
                                      ? "UPI, cards & netbanking"
                                      : g.id === "google"
                                        ? "OAuth 2.0"
                                        : g.id === "stripe"
                                          ? "Hosted payment checkout"
                                          : "Future provider · adapter required"}
                                </p>
                                <span
                                  className={
                                    "badge " + (g.enabled ? "approved" : "")
                                  }
                                >
                                  {g.enabled ? "Enabled" : "Not active"}
                                </span>
                              </div>
                              <button
                                className="button"
                                onClick={() =>
                                  setEdit({
                                    ...g,
                                    secret: "",
                                    webhook_secret: "",
                                  })
                                }
                              >
                                Configure
                                <ChevronRight size={14} />
                              </button>
                            </article>
                          ))}
                        </div>
                        <p className="muted">
                          Secrets are encrypted on the server and never returned
                          to this panel. Blank secret fields preserve the saved
                          value.
                        </p>
                      </>
                    )}
                    {section === "coupons" && (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Code</th>
                              <th>Discount</th>
                              <th>Expires</th>
                              <th>Status</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r.code}>
                                <td>
                                  <strong>{r.code}</strong>
                                </td>
                                <td>{r.percent}%</td>
                                <td>
                                  {r.expires
                                    ? new Date(r.expires).toLocaleDateString()
                                    : "No expiry"}
                                </td>
                                <td>
                                  <span className="badge">
                                    {r.active ? "Active" : "Disabled"}
                                  </span>
                                </td>
                                <td>
                                  <button
                                    title="Edit discount"
                                    className="icon-button"
                                    onClick={() => setEdit(r)}
                                  >
                                    <Pencil size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {section === "payments" && (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Payment</th>
                              <th>Customer</th>
                              <th>Provider</th>
                              <th>Amount</th>
                              <th>Status</th>
                              <th>Receipt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r.id}>
                                <td>
                                  <strong>{r.plan_id}</strong>
                                  <small>{r.id.slice(0, 8)}</small>
                                </td>
                                <td>{r.email}</td>
                                <td>{r.provider}</td>
                                <td>
                                  {money(
                                    majorAmount(r.amount, r.currency),
                                    r.currency,
                                  )}
                                </td>
                                <td>
                                  <span className={"badge " + r.status}>
                                    {r.status}
                                  </span>
                                </td>
                                <td>
                                  {r.status === "paid" && (
                                    <a
                                      href={"/api/receipt/" + r.id}
                                      title="Download receipt"
                                    >
                                      <Download size={16} />
                                    </a>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {section === "audit" && (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Action</th>
                              <th>Details</th>
                              <th>By</th>
                              <th>Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r.id}>
                                <td>
                                  <code>{r.action}</code>
                                </td>
                                <td>{r.detail}</td>
                                <td>{r.actor_name}</td>
                                <td>
                                  {new Date(r.created_at).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {section === "tickets" && (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Subject</th>
                              <th>From</th>
                              <th>Status</th>
                              <th>Received</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r.id}>
                                <td>
                                  <strong>{r.subject}</strong>
                                  <small>{r.message.slice(0, 70)}</small>
                                </td>
                                <td>{r.email}</td>
                                <td>
                                  <span className="badge">{r.status}</span>
                                </td>
                                <td>
                                  {new Date(r.created_at).toLocaleDateString()}
                                </td>
                                <td>
                                  <button
                                    className="button small"
                                    onClick={() => setEdit(r)}
                                  >
                                    Open
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {rows.length === 0 &&
                      !["plans", "gateways"].includes(section) && (
                        <div className="empty compact">
                          <Layers size={28} />
                          <h3>No records yet.</h3>
                          <p>New {section} will appear here.</p>
                        </div>
                      )}
                  </>
                )}
              {section === "system" && data && (
                <>
                  <div className="stats-grid">
                    <Metric
                      label="Application memory"
                      value={(data.memory.rss / 1024 / 1024).toFixed(0) + " MB"}
                      icon={Server}
                    />
                    <Metric
                      label="Host memory used"
                      value={
                        (
                          (1 - data.free_memory / data.total_memory) *
                          100
                        ).toFixed(1) + "%"
                      }
                      icon={Activity}
                    />
                    <Metric
                      label="Load average (1 min)"
                      value={data.load[0].toFixed(2)}
                      icon={TrendingUp}
                    />
                    <Metric
                      label="Process uptime"
                      value={Math.floor(data.uptime / 60) + " min"}
                      icon={Clock}
                    />
                  </div>
                  <section className="system-details">
                    <h2>Environment</h2>
                    {[
                      ["Database", data.database],
                      [
                        "Database size",
                        (Number(data.storage.bytes) / 1024 / 1024).toFixed(1) +
                          " MB",
                      ],
                      ["CPU cores", data.cpus],
                      ["Runtime", data.node],
                      [
                        "Credential encryption",
                        data.encryption_configured
                          ? "Configured"
                          : "Not configured",
                      ],
                      [
                        "Electrical power",
                        "Unavailable: requires host power telemetry",
                      ],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <span>{k}</span>
                        <strong>{v}</strong>
                      </div>
                    ))}
                  </section>
                </>
              )}
              {section === "settings" && data && (
                <SettingsForm
                  key={JSON.stringify(data)}
                  initial={data}
                  saving={saving}
                  save={save}
                />
              )}
            </>
          )}
        </div>
      </main>
      {downloadView && (
        <div className="modal-backdrop" onClick={() => setDownloadView(null)}>
          <section className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span className="eyebrow">DOWNLOAD HISTORY</span>
                <h2>{downloadView.name}</h2>
              </div>
              <button className="icon-button" title="Close downloads" onClick={() => setDownloadView(null)}><X size={18} /></button>
            </div>
            {downloadView.items.length ? (
              <div className="download-history-list">{downloadView.items.map((item, index) => <p key={item + index}>{item}</p>)}</div>
            ) : <p className="muted">No downloads found.</p>}
          </section>
        </div>
      )}
      {edit && (
        <div className="drawer-backdrop" onClick={() => setEdit(null)}>
          <section
            className="edit-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={"Edit " + section}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <span className="eyebrow">{title}</span>
                <h2>
                  {edit.title ||
                    edit.name ||
                    edit.code ||
                    edit.id ||
                    "New record"}
                </h2>
              </div>
              <button
                title="Close editor"
                className="icon-button"
                onClick={() => setEdit(null)}
              >
                <X size={20} />
              </button>
            </div>
            <EntityForm
              section={section}
              initial={edit}
              save={save}
              saving={saving}
            />
          </section>
        </div>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: any;
}) {
  return (
    <div className="stat">
      <div>
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <small>Current reading</small>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: any;
  onChange: (v: any) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {type === "textarea" ? (
        <textarea
          rows={5}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      ) : (
        <input
          type={type}
          value={value ?? ""}
          onChange={(e) =>
            onChange(
              type === "number" ? Number(e.target.value) : e.target.value,
            )
          }
          required={required}
        />
      )}
    </label>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
function EntityForm({
  section,
  initial,
  save,
  saving,
}: {
  section: string;
  initial: any;
  save: (v: any) => void;
  saving: boolean;
}) {
  const [v, setV] = useState(structuredClone(initial)),
    [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});
  const [customSeo, setCustomSeo] = useState(
    Boolean(initial.seo_title || initial.seo_description),
  );
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const { settings } = useApp();
  const jsonError = Object.values(jsonErrors).filter(Boolean).join(" ");
  const setError = (key: string, message: string) =>
    setJsonErrors((errors) => ({ ...errors, [key]: message }));
  const set = (key: string, value: any) =>
    setV((previous: any) => ({ ...previous, [key]: value }));
  const field = (key: string, label: string, type = "text") => (
    <Field
      key={key}
      label={label}
      value={v[key]}
      type={type}
      onChange={(value) => set(key, value)}
    />
  );
  const jsonField = (key: string, label: string) => (
    <label className="field" key={`${key}-${v.kind}`}>
      <span>{label}</span>
      <textarea
        className="code-editor"
        rows={10}
        defaultValue={JSON.stringify(v[key], null, 2)}
        onChange={(e) => {
          try {
            set(key, JSON.parse(e.target.value));
            setError(key, "");
          } catch {
            setError(key, `Please correct ${label} before saving.`);
          }
        }}
      />
    </label>
  );
  return (
    <form
      className="drawer-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!jsonError)
          save({
            ...v,
            slug: v.slug || titleToSlug(v.title),
            plan: v.plan || "free",
            subscription_period: v.subscription_period || "1-month",
            seo_title: customSeo ? v.seo_title : "",
            seo_description: customSeo ? v.seo_description : "",
          });
      }}
    >
      {section === "styles" && (
        <>
          <label className="field">
            <span>Collection / Kind</span>
            <select
              value={v.kind}
              onChange={(e) => {
                const kind = e.target.value;
                setV((previous: any) => ({
                  ...previous,
                  kind,
                  content_json:
                    kind === "3d"
                      ? default3DProject()
                      : kind === "button"
                        ? structuredClone(defaultButtonState)
                        : previous.content_json,
                }));
              }}
            >
              {collectionOptions(settings).map((c) => (
                <option value={c.id} key={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Title"
            value={v.title}
            onChange={(value) =>
              setV((previous: any) => ({
                ...previous,
                title: value,
                slug: slugTouched ? previous.slug : titleToSlug(value),
              }))
            }
          />
          {field("description", "Description", "textarea")}
          <Field
            label="URL slug (optional, auto-generated from title)"
            value={v.slug}
            onChange={(value) => {
              setSlugTouched(true);
              set("slug", value);
            }}
          />
          <div className="two-fields">
            <label className="field">
              <span>Category</span>
              <select
                value={v.style_category || ""}
                onChange={(e) => set("style_category", e.target.value)}
              >
                <option value="">No category</option>
                {(settings.categories || []).map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
                {v.style_category &&
                  !(settings.categories || []).some(
                    (c) => c.id === v.style_category,
                  ) && (
                    <option value={v.style_category}>{v.style_category}</option>
                  )}
              </select>
            </label>
            <label className="field">
              <span>Image badge</span>
              <select
                value={v.badge || ""}
                onChange={(e) => set("badge", e.target.value)}
              >
                <option value="">No badge</option>
                {(settings.badges || []).filter(Boolean).map((badge) => (
                  <option value={badge} key={badge}>
                    {badge}
                  </option>
                ))}
                {v.badge &&
                  !(settings.badges || []).includes(v.badge) && (
                    <option value={v.badge}>{v.badge}</option>
                  )}
              </select>
            </label>
          </div>
          <>
            {field("image_url", "Preview image URL")}
            {field("image_alt", "Image alt text")}
          </>
          <MetadataFields
            key={v.kind}
            kind={v.kind}
            slug={v.slug}
            metadata={v.metadata}
            onChange={(value) => set("metadata", value)}
          />
          <div className="two-fields">
            <Toggle
              label="Premium"
              checked={v.is_premium}
              onChange={(b) => setV({ ...v, is_premium: b, is_free: !b })}
            />
            <Toggle
              label="Published"
              checked={v.is_active}
              onChange={(b) => set("is_active", b)}
            />
          </div>
          <Toggle
            label="Lock editor changes"
            checked={v.is_locked}
            onChange={(b) => set("is_locked", b)}
          />
          <label className="field">
            <span>Review status</span>
            <select
              value={v.status}
              onChange={(e) =>
                setV({
                  ...v,
                  status: e.target.value,
                  is_active: e.target.value === "approved",
                })
              }
            >
              {["approved", "pending", "rejected"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <details>
            <summary>Search engine settings</summary>
            <Toggle
              label="Use custom SEO title and description"
              checked={customSeo}
              onChange={setCustomSeo}
            />
            {customSeo ? (
              <>
                {field("seo_title", "SEO title")}
                {field("seo_description", "SEO description", "textarea")}
                <Field
                  label="Keywords (comma separated)"
                  value={v.seo_keywords.join(", ")}
                  onChange={(x) =>
                    set(
                      "seo_keywords",
                      x.split(",").map((s: string) => s.trim()),
                    )
                  }
                />
              </>
            ) : (
              <p className="muted">Title and description will be used for SEO.</p>
            )}
          </details>
          <details>
            <summary>Editor JSON & metadata</summary>
            {jsonField("content_json", "Editor content JSON")}
            {jsonField("metadata", "Additional metadata")}
            {jsonField("tags", "Tags")}
          </details>
        </>
      )}
      {section === "pages" && (
        <>
          {field("title", "Page title")}
          {field("slug", "Page slug")}
          <label className="field">
            <span>URL type</span>
            <select
              value={v.route_prefix || "p"}
              onChange={(e) => set("route_prefix", e.target.value)}
            >
              <option value="p">/p/ page</option>
              <option value="direct">Direct root page</option>
            </select>
          </label>
          {field("content", "Page content", "textarea")}
          {field("seo_title", "SEO title")}
          {field("seo_description", "SEO description", "textarea")}
          <Toggle
            label="Published"
            checked={v.is_active}
            onChange={(b) => set("is_active", b)}
          />
        </>
      )}
      {section === "plans" && (
        <>
          {field("id", "Plan identifier")}
          {field("name", "Plan name")}
          <div className="two-fields">
            {field("price", "Monthly price", "number")}
            {field("yearly_price", "Yearly price", "number")}
          </div>
          <label className="field">
            <span>Base currency</span>
            <select
              value={v.currency}
              onChange={(e) => set("currency", e.target.value)}
            >
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          {v.id !== "free" && (
            <RegionalPrices
              value={v.regional_prices || []}
              onChange={(prices) => set("regional_prices", prices)}
            />
          )}
          <div className="two-fields">
            {field("download_limit", "Daily downloads", "number")}
            {field("max_quality", "Maximum export pixels", "number")}
          </div>
          <Field
            label="Features (one per line)"
            type="textarea"
            value={v.features.join("\n")}
            onChange={(s) => set("features", s.split("\n"))}
          />
          <Toggle
            label="Available to users"
            checked={v.active}
            onChange={(b) => set("active", b)}
          />
        </>
      )}
      {section === "users" && (
        <>
          <p className="muted">{v.email}</p>
          <label className="field">
            <span>Role</span>
            <select
              value={v.role}
              onChange={(e) => set("role", e.target.value)}
            >
              {["user", "admin", "moderator", "support"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <div className="two-fields">
            <label className="field">
              <span>Plan</span>
              <select
                value={v.plan || "free"}
                onChange={(e) => set("plan", e.target.value)}
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="studio">Studio</option>
              </select>
            </label>
            <label className="field">
              <span>Plan duration</span>
              <select
                value={v.subscription_period || "1-month"}
                onChange={(e) => set("subscription_period", e.target.value)}
              >
                <option value="1-month">1 month</option>
                <option value="1-year">1 year</option>
              </select>
            </label>
          </div>
          {v.plan && v.plan !== "free" && v.plan_expires && (
            <small className="muted">
              Current access until {new Date(v.plan_expires).toLocaleDateString()}
            </small>
          )}
          <Toggle
            label="Account active"
            checked={v.active}
            onChange={(b) => set("active", b)}
          />
          <span className="field-label">Panel permissions</span>
          {sections
            .filter((s) => s.permission !== "owner")
            .map((s) => (
              <Toggle
                key={s.id}
                label={s.label}
                checked={v.permissions.includes(s.permission)}
                onChange={(b) =>
                  set(
                    "permissions",
                    b
                      ? [...v.permissions, s.permission]
                      : v.permissions.filter((p: string) => p !== s.permission),
                  )
                }
              />
            ))}
        </>
      )}
      {section === "gateways" && (
        <>
          <Toggle
            label="Enabled"
            checked={v.enabled}
            onChange={(b) => set("enabled", b)}
          />
          <label className="field">
            <span>Environment</span>
            <select
              value={v.mode}
              onChange={(e) => set("mode", e.target.value)}
            >
              <option>test</option>
              <option>live</option>
            </select>
          </label>
          {field(
            "public_key",
            v.id === "google" ? "Google client ID" : "Public key / key ID",
          )}
          {field(
            "secret",
            v.id === "google" ? "Client secret" : "Secret key",
            "password",
          )}
          {v.secret_configured && (
            <small className="success-text">A secret is already stored.</small>
          )}
          {v.id !== "google" &&
            field("webhook_secret", "Webhook signing secret", "password")}
          <div className="info-note">
            <code>
              {v.id === "google"
                ? "/api/auth/google/callback"
                : "/api/webhooks/" + v.id}
            </code>
            <p>
              {v.id === "google"
                ? "Use this path as the authorized redirect URI on your public domain."
                : "Use this endpoint for signed payment events."}
            </p>
          </div>
        </>
      )}
      {section === "coupons" && (
        <>
          {field("code", "Discount code")}
          {field("percent", "Percentage off", "number")}
          <Field
            label="Expiry"
            type="datetime-local"
            value={v.expires ? String(v.expires).slice(0, 16) : ""}
            onChange={(x) =>
              set("expires", x ? new Date(x).toISOString() : null)
            }
          />
          <Toggle
            label="Active"
            checked={v.active}
            onChange={(b) => set("active", b)}
          />
        </>
      )}
      {section === "tickets" && (
        <>
          <p>
            <strong>{v.name}</strong>
            <br />
            {v.email}
          </p>
          <blockquote>{v.message}</blockquote>
          {field("reply", "Internal resolution / reply draft", "textarea")}
          <label className="field">
            <span>Status</span>
            <select
              value={v.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option>open</option>
              <option>resolved</option>
            </select>
          </label>
        </>
      )}
      {jsonError && <p className="form-error">{jsonError}</p>}
      <div className="drawer-save">
        <button className="button accent full" disabled={saving || !!jsonError}>
          <Save size={16} />
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
function SettingsForm({
  initial,
  save,
  saving,
}: {
  initial: any;
  save: (v: any) => void;
  saving: boolean;
}) {
  const [v, setV] = useState(structuredClone(initial)),
    [tab, setTab] = useState("general"),
    [error, setError] = useState("");
  const set = (k: string, x: any) =>
    setV((previous: any) => ({ ...previous, [k]: x }));
  return (
    <div className="settings-layout">
      <div className="settings-nav">
        {[
          "general",
          "content",
          "categories",
          "advertising",
          "footer",
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <ChevronRight size={14} />
          </button>
        ))}
      </div>
      <form
        className="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!error) save(v);
        }}
      >
        <h2>{tab.charAt(0).toUpperCase() + tab.slice(1)}</h2>
        {tab === "content" && (
          <>
            <Field
              label="Homepage styles per load"
              type="number"
              value={v.home_style_count ?? 30}
              onChange={(value) => set("home_style_count", value)}
            />
            <Field
              label="Related styles total"
              type="number"
              value={v.related_count ?? 30}
              onChange={(value) => set("related_count", value)}
            />
            <CollectionFields
              settings={v}
              onChange={(value) => set("collection_content", value)}
            />
          </>
        )}
        {tab === "general" && (
          <>
            <Field
              label="Site name"
              value={v.site_name}
              onChange={(s) => set("site_name", s)}
            />
            <Field
              label="Site description"
              value={v.description}
              type="textarea"
              onChange={(s) => set("description", s)}
            />
            <Field
              label="Announcement"
              value={v.announcement}
              onChange={(s) => set("announcement", s)}
            />
            <Field
              label="Announcement link text"
              value={v.announcement_link_text || ""}
              onChange={(s) => set("announcement_link_text", s)}
            />
            <Field
              label="Announcement link URL"
              value={v.announcement_url || ""}
              onChange={(s) => set("announcement_url", s)}
            />
            <Field
              label="Social handle"
              value={v.social_handle}
              onChange={(s) => set("social_handle", s)}
            />
            <Toggle
              label="Maintenance mode"
              checked={v.maintenance}
              onChange={(s) => set("maintenance", s)}
            />
          </>
        )}
        {tab === "categories" && (
          <>
            {v.categories.map((c: any, i: number) => (
              <div className="nav-editor-row" key={i}>
                <Field
                  label="Name"
                  value={c.name}
                  onChange={(s) =>
                    set(
                      "categories",
                      v.categories.map((x: any, j: number) =>
                        j === i ? { ...x, name: s } : x,
                      ),
                    )
                  }
                />
                <Field
                  label="Route identifier"
                  value={c.id}
                  onChange={(s) =>
                    set(
                      "categories",
                      v.categories.map((x: any, j: number) =>
                        j === i ? { ...x, id: s } : x,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  title="Remove collection"
                  className="icon-button"
                  disabled={v.categories.length <= 1}
                  onClick={() =>
                    set(
                      "categories",
                      v.categories.filter((_: any, j: number) => j !== i),
                    )
                  }
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button"
              onClick={() =>
                set("categories", [
                  ...v.categories,
                  { id: "collection", name: "Collection" },
                ])
              }
            >
              <Plus size={16} />
              Add collection
            </button>
            <Field
              label="Available image badges (comma separated)"
              value={v.badges.join(", ")}
              onChange={(s) =>
                set(
                  "badges",
                  s.split(",").map((x: string) => x.trim()),
                )
              }
            />
          </>
        )}
        {tab === "advertising" && (
          <>
            <Toggle
              label="Enable ads for free users"
              checked={v.ads_enabled}
              onChange={(s) => set("ads_enabled", s)}
            />
            <Field
              label="AdSense publisher ID"
              value={v.ad_client}
              onChange={(s) =>
                set("ad_client", s.trim().replace(/^pub-/i, "ca-pub-"))
              }
            />
            <p className="muted">
              Use the publisher ID only, for example{" "}
              <code>ca-pub-123456789</code>. Add only the numeric value for an
              ad slot.
            </p>
            {v.ad_slots.map((slot: any, i: number) => (
              <div className="ad-slot-row" key={i}>
                <label className="field">
                  <span>Placement</span>
                  <select
                    value={slot.position}
                    onChange={(e) =>
                      set(
                        "ad_slots",
                        v.ad_slots.map((x: any, j: number) =>
                          i === j ? { ...x, position: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    {["home-bottom", "editor-bottom", "related-bottom"].map(
                      (p) => (
                        <option key={p}>{p}</option>
                      ),
                    )}
                  </select>
                </label>
                <Field
                  label="Ad slot ID"
                  value={slot.slot}
                  onChange={(s) =>
                    set(
                      "ad_slots",
                      v.ad_slots.map((x: any, j: number) =>
                        i === j ? { ...x, slot: s } : x,
                      ),
                    )
                  }
                />
                <Toggle
                  label="Active"
                  checked={slot.enabled}
                  onChange={(s) =>
                    set(
                      "ad_slots",
                      v.ad_slots.map((x: any, j: number) =>
                        i === j ? { ...x, enabled: s } : x,
                      ),
                    )
                  }
                />
                <details>
                  <summary>Manual fallback ad</summary>
                  <Toggle
                    label="Enable manual fallback"
                    checked={slot.manual_enabled}
                    onChange={(s) =>
                      set(
                        "ad_slots",
                        v.ad_slots.map((x: any, j: number) =>
                          i === j ? { ...x, manual_enabled: s } : x,
                        ),
                      )
                    }
                  />
                  <Field
                    label="HTML"
                    type="textarea"
                    value={slot.manual_html || ""}
                    onChange={(s) =>
                      set(
                        "ad_slots",
                        v.ad_slots.map((x: any, j: number) =>
                          i === j ? { ...x, manual_html: s } : x,
                        ),
                      )
                    }
                  />
                  <Field
                    label="CSS"
                    type="textarea"
                    value={slot.manual_css || ""}
                    onChange={(s) =>
                      set(
                        "ad_slots",
                        v.ad_slots.map((x: any, j: number) =>
                          i === j ? { ...x, manual_css: s } : x,
                        ),
                      )
                    }
                  />
                  <Field
                    label="JavaScript"
                    type="textarea"
                    value={slot.manual_js || ""}
                    onChange={(s) =>
                      set(
                        "ad_slots",
                        v.ad_slots.map((x: any, j: number) =>
                          i === j ? { ...x, manual_js: s } : x,
                        ),
                      )
                    }
                  />
                </details>
              </div>
            ))}
            <button
              className="button"
              type="button"
              onClick={() =>
                set("ad_slots", [
                  ...v.ad_slots,
                  {
                    position: "home-bottom",
                    slot: "",
                    enabled: false,
                    manual_enabled: false,
                    manual_html: "",
                    manual_css: "",
                    manual_js: "",
                  },
                ])
              }
            >
              <Plus size={16} />
              Add placement
            </button>
            <Field
              label="Disabled page paths (one per line)"
              value={v.ad_disabled_pages.join("\n")}
              type="textarea"
              onChange={(s) => set("ad_disabled_pages", s.split("\n"))}
            />
            <p className="muted">
              Paid members, administrators and the owner are always excluded.
            </p>
          </>
        )}
        {tab === "footer" && (
          <>
            <Field
              label="Footer description"
              value={v.footer_description || ""}
              onChange={(s) => set("footer_description", s)}
            />
            {(v.footer_columns || []).map((column: any, i: number) => (
              <div className="footer-settings-group" key={i}>
                <Field
                  label={`Column ${i + 1} title`}
                  value={column.title || ""}
                  onChange={(s) =>
                    set("footer_columns", v.footer_columns.map((x: any, j: number) => i === j ? { ...x, title: s } : x))
                  }
                />
                <Field
                  label="Links (one per line: Label | /url)"
                  type="textarea"
                  value={(column.links || []).map((link: any) => `${link.label} | ${link.href}`).join("\n")}
                  onChange={(value) =>
                    set("footer_columns", v.footer_columns.map((x: any, j: number) => i === j ? {
                      ...x,
                      links: value.split("\n").map((line: string) => {
                        const [label, ...href] = line.split("|");
                        return { label: label.trim(), href: href.join("|").trim() };
                      }).filter((link: any) => link.label && link.href),
                    } : x))
                  }
                />
              </div>
            ))}
            <Field
              label="Copyright text"
              value={v.footer_copyright || ""}
              onChange={(s) => set("footer_copyright", s)}
            />
            <Field
              label="Footer bottom tagline"
              value={v.footer_tagline || ""}
              onChange={(s) => set("footer_tagline", s)}
            />
          </>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="settings-save">
          <button className="button accent" disabled={saving}>
            <Save size={16} />
            {saving ? "Saving..." : "Save settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
