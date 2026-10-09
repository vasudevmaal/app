"use client";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  Check,
  Sparkles,
  Box,
  WandSparkles,
  Palette,
  Braces,
  SearchX,
  LockKeyhole,
} from "lucide-react";
import type { Style } from "@/lib/types";
import { Preview } from "./preview";
import { useApp } from "./providers";
import { api } from "@/lib/client";
import { collectionContent } from "@/lib/content";
import { StyleThumbnail } from "./style-thumbnail";
import { CatalogDropdown } from "./catalog-dropdown";
import { CategorySeo } from "./content-sections";
import { collectionPath } from "@/lib/routes";
export function StyleCard({
  style,
  initialSaved = false,
}: {
  style: Style;
  initialSaved?: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved),
    [busy, setBusy] = useState(false);
  const { user, toast } = useApp();
  return (
    <article className="style-card">
      <div className="style-image">
        <Link
          href={"/" + collectionPath(style.kind) + "/" + style.slug}
          aria-label={"Open " + style.title}
        >
          <StyleThumbnail style={style} />
        </Link>
        <button
          title={saved ? "Remove from favorites" : "Save style"}
          className={"favorite " + (saved ? "saved" : "")}
          disabled={busy}
          onClick={async () => {
            if (!user) {
              window.location.href = "/login";
              return;
            }
            setBusy(true);
            try {
              await api(
                "favorites",
                { style_id: style.id },
                saved ? "DELETE" : "POST",
              );
              setSaved(!saved);
              toast(
                saved ? "Removed from favorites" : "Saved to your collection",
              );
            } catch (e) {
              toast((e as Error).message, true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Heart size={17} fill={saved ? "currentColor" : "none"} />
        </button>
        {style.is_premium && (
          <span className="premium-mark">
            <Sparkles size={12} />
            PRO
          </span>
        )}
        {style.badge && <span className="identity-badge">{style.badge}</span>}
      </div>
      <Link
        className="style-caption"
        href={"/" + collectionPath(style.kind) + "/" + style.slug}
      >
        <div>
          <h3>{style.title}</h3>
          <p>
            {style.kind === "3d-text"
              ? "3D Text"
              : style.kind === "ai"
                ? "AI Design"
                : style.kind === "3d"
                  ? "3D Studio"
                  : style.kind === "visual"
                    ? "Visual"
                    : "Design"}{" "}
            <span>·</span>{" "}
            {style.style_category || (style.kind === "3d" ? "Silver" : "")}
          </p>
        </div>
        <ArrowUpRight size={17} />
      </Link>
    </article>
  );
}

export function PinterestGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const gridRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === "undefined") return;
    let frame = 0;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const cards = Array.from(grid.children) as HTMLElement[];
        if (!cards.length) return;
        cards.forEach((card) => card.style.removeProperty("grid-row-end"));
        const styles = getComputedStyle(grid);
        const rowHeight = parseFloat(styles.gridAutoRows) || 8;
        const rowGap = parseFloat(styles.rowGap) || 0;
        cards.forEach((card) => {
          const span = Math.max(
            1,
            Math.ceil((card.scrollHeight + rowGap) / (rowHeight + rowGap)),
          );
          card.style.gridRowEnd = `span ${span}`;
        });
      });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    const images = Array.from(grid.querySelectorAll("img"));
    images.forEach((image) => image.addEventListener("load", measure));
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      images.forEach((image) => image.removeEventListener("load", measure));
    };
  }, [children]);

  return (
    <div ref={gridRef} className={`style-grid pinterest-grid ${className}`}>
      {children}
    </div>
  );
}

const categoryIcons = [Box, WandSparkles, Palette, Braces];
export function Gallery({
  styles,
  kind,
  term,
  grouped = false,
  collectionCounts,
}: {
  styles: Style[];
  kind?: string;
  term?: string;
  grouped?: boolean;
  collectionCounts?: Record<string, number>;
}) {
  const router = useRouter();
  const { settings } = useApp();
  const content = collectionContent(settings, kind || "home");
  const pageSize =
    !kind && !term
      ? Math.max(1, Math.min(120, Number(settings.home_style_count ?? 30)))
      : 12;
  const [collectionKind, setCollectionKind] = useState("all"),
    [category, setCategory] = useState("all"),
    [sort, setSort] = useState("curated"),
    [access, setAccess] = useState("all"),
    [fileType, setFileType] = useState("all"),
    [count, setCount] = useState(pageSize);
  const tagRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tagRowRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [styles, kind, term]);
  const scrollTags = (direction: -1 | 1) => {
    const row = tagRowRef.current;
    if (!row) return;
    row.scrollBy({
      left: direction * Math.max(180, Math.round(row.clientWidth * 0.65)),
      behavior: "smooth",
    });
  };
  const tags = useMemo(
    () =>
      [
        "all",
        ...new Set(
          styles
            .map((s) => s.style_category || (s.kind === "3d" ? "Silver" : ""))
            .filter(Boolean),
        ),
      ].slice(0, 11),
    [styles],
  );
  const filtered = useMemo(
    () =>
      styles
        .filter(
          (s) =>
            (collectionKind === "all" || s.kind === collectionKind) &&
            (category === "all" ||
              (s.style_category || (s.kind === "3d" ? "Silver" : "")) ===
                category) &&
            (access === "all" ||
              (access === "free" ? !s.is_premium : s.is_premium)) &&
            (fileType === "all" ||
              (Array.isArray(s.metadata.file_types)
                ? s.metadata.file_types
                : s.kind === "visual"
                  ? ["PNG"]
                  : s.kind === "3d-text"
                    ? ["PNG", "GIF", "SVG"]
                    : ["PNG", "GIF"]
              )
                .map((value) => String(value).toUpperCase())
                .includes(fileType)),
        )
        .sort((a, b) =>
          sort === "popular"
            ? b.download_count - a.download_count
            : sort === "newest"
              ? new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
              : Number(!!b.metadata.featured) - Number(!!a.metadata.featured),
        ),
    [styles, collectionKind, category, sort, access, fileType],
  );
  const visibleStyles = filtered.slice(0, term ? filtered.length : count);
  return (
    <main className="catalog main-width">
      <div className="catalog-title">
        <div className="eyebrow">THE CREATIVE COLLECTION</div>
        <div className="title-row">
          <div>
            <h1>{term ? `Results for “${term}”` : content.title}</h1>
            <p>
              {term
                ? `${filtered.length} styles to make your own`
                : content.description}
            </p>
          </div>
        </div>
      </div>
      {!kind && !term && (
        <div className="category-strip">
          {settings.categories.map((c, i) => {
            const Icon = categoryIcons[i % 4];
            return (
              <Link
                key={c.id}
                href={"/" + c.id}
                className={"category-link category-" + i}
              >
                <span className="category-icon">
                  <Icon size={24} />
                </span>
                <span>
                  <strong>{c.name}</strong>
                  <small>
                    {collectionCounts?.[c.id] ??
                      styles.filter((s) => s.kind === c.id).length}{" "}
                    creative styles
                  </small>
                </span>
                <ArrowUpRight size={19} />
              </Link>
            );
          })}
        </div>
      )}
      <div className="catalog-toolbar">
        <div className="catalog-tabs">
          <button className="active">
            {term ? "Matching styles" : "Discover styles"}
          </button>
          <span className="count-pill">{filtered.length}</span>
        </div>
        <div className="toolbar-actions">
          <div className="sort-control">
            <span>Sort by:</span>
            <CatalogDropdown
              label="Sort styles"
              value={sort}
              onChange={setSort}
              options={[
                { value: "curated", label: "Curated" },
                { value: "newest", label: "Newest" },
                { value: "popular", label: "Popular" },
              ]}
            />
          </div>
        </div>
      </div>
      <div className="tag-row-wrap">
        <button
          className="tag-scroll-button"
          title="Scroll categories left"
          onClick={() => scrollTags(-1)}
        >
          <ChevronLeft size={17} />
        </button>
        <div className="catalog-inline-filters" ref={tagRowRef}>
          {!kind && (
            <div className="catalog-filter">
              <CatalogDropdown
                label="Filter by collection"
                value={collectionKind}
                onChange={(value) => {
                  if (!kind && !term && value === "visual") {
                    router.push("/visual");
                    return;
                  }
                  setCollectionKind(value);
                  setCategory("all");
                  setCount(pageSize);
                }}
                options={[
                  { value: "all", label: "All" },
                  { value: "3d-text", label: "3D Text" },
                  { value: "ai", label: "AI Design" },
                  { value: "design", label: "Design" },
                  { value: "3d", label: "3D Studio" },
                  { value: "visual", label: "Visual" },
                ]}
              />
            </div>
          )}
          <div className="catalog-filter">
            <CatalogDropdown
              label="Filter styles"
              value={category}
              onChange={(value) => {
                setCategory(value);
                setCount(pageSize);
              }}
              options={[
                { value: "all", label: "All styles" },
                ...tags.slice(1).map((tag) => ({
                  value: tag,
                  label: tag.charAt(0).toUpperCase() + tag.slice(1),
                })),
              ]}
            />
          </div>
          <div className="catalog-filter">
            <CatalogDropdown
              label="Filter by licence"
              value={access}
              onChange={(value) => {
                setAccess(value);
                setCount(pageSize);
              }}
              options={[
                { value: "all", label: "Licence" },
                { value: "free", label: "Free" },
                { value: "premium", label: "Premium" },
              ]}
            />
          </div>
          <div className="catalog-filter">
            <CatalogDropdown
              label="Filter by file type"
              value={fileType}
              onChange={(value) => {
                setFileType(value);
                setCount(pageSize);
              }}
              options={[
                { value: "all", label: "File type" },
                ...["PNG", "GIF", "JPG", "PDF", "SVG"].map((type) => ({
                  value: type,
                  label: type,
                })),
              ]}
            />
          </div>
        </div>
        <button
          className="tag-scroll-button"
          title="Scroll categories right"
          onClick={() => scrollTags(1)}
        >
          <ChevronRight size={17} />
        </button>
        <button
          className="catalog-reset"
          type="button"
          onClick={() => {
            setCategory("all");
            setCollectionKind("all");
            setAccess("all");
            setFileType("all");
            setCount(pageSize);
          }}
        >
          Reset all
        </button>
      </div>
      {filtered.length === 0 ? (
        <div className="empty">
          <SearchX size={34} />
          <h2>No matching styles</h2>
          <p>Try another search or reset your filters.</p>
        </div>
      ) : grouped ? (
        <div className="search-groups">
          {settings.categories.map((c) => {
            const entries = filtered.filter((s) => s.kind === c.id);
            return entries.length ? (
              <section key={c.id}>
                <div className="section-title">
                  <h2>
                    {c.name}
                    <span className="count-pill">{entries.length}</span>
                  </h2>
                  <Link
                    href={`/${c.id}/search/${encodeURIComponent(term || "")}`}
                  >
                    See more related <ArrowUpRight size={16} />
                  </Link>
                </div>
                <PinterestGrid>
                  {entries.slice(0, 4).map((s) => (
                    <StyleCard key={s.id} style={s} />
                  ))}
                </PinterestGrid>
              </section>
            ) : null;
          })}
        </div>
      ) : (
        <PinterestGrid>
          {visibleStyles.map((s) => (
            <StyleCard key={s.id} style={s} />
          ))}
        </PinterestGrid>
      )}
      {!term && filtered.length > count && (
        <div className="load-more">
          <p>
            Showing {Math.min(count, filtered.length)} of {filtered.length}{" "}
            styles
          </p>
          <button className="button" onClick={() => setCount(count + pageSize)}>
            Load more styles <ArrowDown size={16} />
          </button>
        </div>
      )}
      {!term && (
        <div className="catalog-end">
          <CategorySeo kind={kind || "home"} content={content} />
        </div>
      )}
    </main>
  );
}
