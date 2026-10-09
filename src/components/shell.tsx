"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, FormEvent } from "react";
import {
  Search,
  ArrowUpRight,
  Sparkles,
  ChevronDown,
  LogOut,
  UserRound,
  LayoutDashboard,
  Monitor,
  Moon,
  Sun,
  Plus,
  ArrowUp,
} from "lucide-react";
import { useApp } from "./providers";
import { api } from "@/lib/client";
import { CatalogDropdown } from "./catalog-dropdown";
export function Logo() {
  return (
    <Link className="brand" href="/" aria-label="EXCPIX home">
      <span className="brand-symbol">
        <span />
        <span />
        <span />
        <span />
      </span>
      EXCPIX
    </Link>
  );
}
export function Header() {
  const { user, settings } = useApp(),
    router = useRouter(),
    pathname = usePathname();
  const showPricing = !user || user.plan === "free";
  const [term, setTerm] = useState(""),
    [searchCategory, setSearchCategory] = useState("all"),
    [account, setAccount] = useState(false),
    [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setAccount(false);
  }, [pathname]);
  useEffect(() => {
    if (!account) return;
    const outside = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node))
        setAccount(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccount(false);
        accountButton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [account]);
  useEffect(() => {
    const apply = (value: "system" | "light" | "dark") => {
      const next =
        value === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : value;
      document.documentElement.dataset.theme = next;
    };
    const saved = localStorage.getItem("excpix-theme") as
      "system" | "light" | "dark" | null;
    const current = saved || "system";
    setTheme(current);
    apply(current);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      if ((localStorage.getItem("excpix-theme") || "system") === "system")
        apply("system");
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  function chooseTheme(value: "system" | "light" | "dark") {
    setTheme(value);
    localStorage.setItem("excpix-theme", value);
    document.documentElement.dataset.theme =
      value === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : value;
  }
  const search = (e: FormEvent) => {
    e.preventDefault();
    if (term.trim()) {
      const encodedTerm = encodeURIComponent(term.trim());
      router.push(
        searchCategory === "all"
          ? "/search/" + encodedTerm
          : "/" + searchCategory + "/search/" + encodedTerm,
      );
    }
  };
  return (
    <>
      <header className="header">
        <div className="header-main">
          <Logo />
          <form className="header-search" onSubmit={search}>
            <Search size={19} />
            <input
              aria-label="Search styles"
              placeholder="Search text styles, AI design, designs..."
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <CatalogDropdown
              className="header-search-category"
              label="Search category"
              value={searchCategory}
              onChange={setSearchCategory}
              options={[
                { value: "all", label: "All" },
                { value: "3d-text", label: "3D Text" },
                { value: "ai", label: "AI" },
                { value: "design", label: "Design" },
                { value: "3d-studio", label: "3D Studio" },
                { value: "visual", label: "Visual" },
              ]}
            />
            <button type="submit" title="Search">
              <ArrowUpRight size={19} />
            </button>
          </form>
          <div className="header-actions">
            {showPricing && (
              <Link className="upgrade-link" href="/pricing">
                <Sparkles size={16} /> Pricing
              </Link>
            )}
            {user ? (
              <div
                className="account-menu"
                ref={accountRef}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget))
                    setAccount(false);
                }}
              >
                <button
                  ref={accountButton}
                  className="avatar"
                  title="Account menu"
                  aria-expanded={account}
                  aria-controls="account-popover"
                  onClick={() => setAccount(!account)}
                >
                  {user.name.slice(0, 1)}
                </button>
                {account && (
                  <div
                    className="dropdown"
                    id="account-popover"
                    role="region"
                    aria-label="Your account"
                  >
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                    <div
                      className="theme-switch"
                      role="group"
                      aria-label="Theme"
                    >
                      {[
                        { id: "system", label: "System", icon: Monitor },
                        { id: "light", label: "Light", icon: Sun },
                        { id: "dark", label: "Dark", icon: Moon },
                      ].map((item) => (
                        <button
                          key={item.id}
                          className={theme === item.id ? "active" : ""}
                          onClick={() =>
                            chooseTheme(item.id as "system" | "light" | "dark")
                          }
                          title={item.label + " theme"}
                        >
                          <item.icon size={14} />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                    <Link
                      href={"/user/" + user.username}
                      onClick={() => setAccount(false)}
                    >
                      <UserRound size={16} />
                      My workspace
                    </Link>
                    {user.role !== "user" && (
                      <Link
                        href={user.role === "owner" ? "/owner" : "/admin"}
                        onClick={() => setAccount(false)}
                      >
                        <LayoutDashboard size={16} />
                        Control panel
                      </Link>
                    )}
                    <button
                      onClick={async () => {
                        await api("auth/logout", {});
                        window.location.href = "/";
                      }}
                    >
                      <LogOut size={16} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link className="button small dark" href="/login">
                Sign in <ArrowUpRight size={15} />
              </Link>
            )}
          </div>
        </div>
      </header>
      {settings.announcement && (
        <div className="announcement">
          <span>{settings.announcement}</span>
          {typeof settings.announcement_url === "string" &&
            settings.announcement_url && (
              <a href={settings.announcement_url}>
                {String(settings.announcement_link_text || "Learn more")}
                <ArrowUpRight size={14} />
              </a>
            )}
        </div>
      )}
    </>
  );
}
export function Footer() {
  const { settings } = useApp();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-directory">
          <div className="footer-brand-block">
            <Logo />
            <p>
              {settings.footer_description ||
                "Make type that feels unmistakably yours."}
            </p>
          </div>
          {(settings.footer_columns || []).map((column, index) => (
            <div className="footer-link-group" key={column.title || index}>
              <strong>{column.title}</strong>
              {column.links.map((link) => (
                <Link key={link.href + link.label} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <small>
            © {new Date().getFullYear()} {settings.site_name}.{" "}
            {settings.footer_copyright || "All rights reserved."}
          </small>
          <span>
            {settings.footer_tagline || "Built for better lettering."}
          </span>
        </div>
      </div>
    </footer>
  );
}
export function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button
      className="back-to-top icon-button"
      title="Back to top"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <ArrowUp size={18} />
    </button>
  );
}
