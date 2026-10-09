import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { detectCountry } from "@/lib/billing";
import type { Metadata } from "next";
import { getStyles, getStyle, getPlans, getSettings } from "@/lib/data";
import { currentUser } from "@/lib/auth";
import { AIEditor } from "@/components/ai-editor";
import { Related } from "@/components/related";
import { FAQSection, HowTo } from "@/components/content-sections";
import { collectionContent, visibleFAQs, selectRelated } from "@/lib/content";
import { one, query } from "@/lib/db";
import { Gallery } from "@/components/gallery";
import { Editor } from "@/components/editor";
import { Text3DEditor } from "@/components/text3d/editor";
import { text3dProjectSchema } from "@/lib/text3d-project";
import { buttonStateSchema } from "@/lib/button";
import { ButtonEditor } from "@/components/button/editor";
import {
  Login,
  Subscription,
  Contact,
  UserPanel,
  PaymentResult,
} from "@/components/account";
import { Admin } from "@/components/admin";
import { AdSlot } from "@/components/ads";
import { collectionKind } from "@/lib/routes";
type Props = {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const contentKinds = new Set([
  "3d-text",
  "ai",
  "design",
  "3d-studio",
  "text",
  "visual",
  "button",
]);
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path } = await params;
  const url = "/" + path.map(encodeURIComponent).join("/");
  if (path.length === 1) {
    const settings = await getSettings();
    if (
      path[0] === "faq" ||
      contentKinds.has(path[0]) ||
      settings.categories.some((c) => c.id === path[0])
    ) {
      const content = collectionContent(settings, collectionKind(path[0]));
      return {
        title: content.seo_title || content.title,
        description: content.seo_description || content.description,
        alternates: { canonical: url },
      };
    }
  }
  if (["owner", "admin", "user", "login", "payment"].includes(path[0]))
    return {
      title: path[0] === "owner" ? "Owner Workspace" : "Your Workspace",
      robots: { index: false, follow: false },
    };
  if (path[0] === "search" || path[1] === "search")
    return {
      title: "Search " + decodeURIComponent(path.at(-1) || ""),
      robots: { index: false, follow: true },
    };
  if (path[0] === "3d-studio" && path[1] === "3d-text" && path.length === 2)
    return {
      title: "3D Text Generator",
      description:
        "Create custom 3D text with premade styles, fonts and materials.",
      alternates: { canonical: url },
      openGraph: {
        title: "3D Text Generator",
        description:
          "Create custom 3D text with premade styles, fonts and materials.",
        images: ["/images/tools/3d-text.png"],
      },
    };
  if (path[0] === "p") {
    const p = await one<any>(
      "SELECT * FROM pages WHERE slug=$1 AND route_prefix='p' AND is_active=true",
      [path[1]],
    );
    if (p)
      return {
        title: p.seo_title || p.title,
        description: p.seo_description || p.content.slice(0, 160),
        alternates: { canonical: url },
      };
  }
  if (path.length === 1) {
    const directSlug =
      path[0] === "term" || path[0] === "terms"
        ? "terms"
        : path[0] === "privacy" || path[0] === "privacy-policy"
          ? "privacy-policy"
          : path[0];
    const p = await one<any>(
      "SELECT * FROM pages WHERE slug=$1 AND route_prefix='direct' AND is_active=true",
      [directSlug],
    );
    if (p)
      return {
        title: p.seo_title || p.title,
        description: p.seo_description || p.content.slice(0, 160),
        alternates: { canonical: url },
      };
  }
  if (path.length === 2) {
    const s = await getStyle(collectionKind(path[0]), path[1]);
    if (s) {
      const title = s.seo_title || s.title,
        description = s.seo_description || s.description;
      const image = s.image_url || "/previews/" + s.slug + ".png";
      return {
        title: { absolute: title },
        description,
        keywords: s.seo_keywords,
        alternates: { canonical: url },
        openGraph: {
          title,
          description,
          type: "article",
          url,
          siteName: "EXCPIX",
          images: [{ url: image, alt: s.image_alt || s.title }],
        },
        twitter: {
          card: "summary_large_image",
          title,
          description,
          images: [image],
        },
      };
    }
  }
  return {
    title: path[0].charAt(0).toUpperCase() + path[0].slice(1),
    alternates: { canonical: url },
  };
}
export default async function Page({ params, searchParams }: Props) {
  const { path } = await params;
  const searchQuery = await searchParams;
  const [first, second, third] = path;
  if (first === "svg-text") notFound();
  const settings = await getSettings();
  await query(
    "ALTER TABLE pages ADD COLUMN IF NOT EXISTS route_prefix TEXT NOT NULL DEFAULT 'p'",
    [],
  );
  await query(
    "UPDATE pages SET route_prefix='direct' WHERE slug IN ('about','terms','privacy-policy','return-policy')",
    [],
  );
  if (first === "faq" && path.length === 1) {
    const content = collectionContent(settings, "faq");
    return (
      <main className="prose-page main-width">
        <h1>{content.title}</h1>
        {content.description && <p>{content.description}</p>}
        <FAQSection items={visibleFAQs(undefined, content)} />
      </main>
    );
  }
  if (first === "login" && path.length === 1) {
    const google = await one<{ enabled: boolean; public_key: string }>(
      "SELECT enabled,public_key FROM gateways WHERE id='google'",
    );
    const turnstile = await one<{ enabled: boolean; public_key: string }>(
      "SELECT enabled,public_key FROM gateways WHERE id='turnstile'",
    );
    return (
      <Login
        googleEnabled={google?.enabled}
        turnstileSiteKey={turnstile?.enabled ? turnstile.public_key : ""}
      />
    );
  }
  if (first === "subscription" && path.length === 1) redirect("/pricing");
  if (first === "pricing" && path.length === 1)
    return (
      <Subscription
        initialCountry={detectCountry(await headers())}
        plans={await getPlans()}
        gateways={await query(
          "SELECT id FROM gateways WHERE enabled=true AND id IN ('stripe','razorpay')",
        )}
      />
    );
  if (first === "contact" && path.length === 1) return <Contact />;
  if (first === "3d-studio" && second === "3d-text" && path.length === 2) {
    const tool = await getStyle("3d", "3d-text");
    const project = tool
      ? text3dProjectSchema.safeParse(tool.content_json)
      : null;
    const content = collectionContent(settings, "3d");
    const related = tool
      ? selectRelated(
          tool,
          await getStyles(undefined, undefined, 10000),
          Number(settings.related_count ?? 30),
        )
      : [];
    return (
      <>
        <Text3DEditor
          styleId={tool?.id}
          initialProject={project?.success ? project.data : undefined}
          title={tool?.title}
          description={tool?.description}
        />
        <div className="main-width content-sections">
          <HowTo content={content} />
          <Related style={tool!} styles={related} />
        </div>
      </>
    );
  }
  if ((first === "owner" || first === "admin") && path.length === 1) {
    const u = await currentUser();
    if (!u) redirect("/login");
    if (u.role === "user" || (first === "owner" && u.role !== "owner"))
      notFound();
    return <Admin />;
  }
  if (first === "user" && second) {
    const u = await currentUser();
    if (!u) redirect("/login");
    if (u.username !== second) notFound();
    return <UserPanel />;
  }
  if (first === "payment" && third) {
    const u = await currentUser();
    if (!u) redirect("/login");
    const p = await one("SELECT * FROM payments WHERE id=$1 AND user_id=$2", [
      third,
      u.id,
    ]);
    if (!p) notFound();
    return <PaymentResult payment={p} cancelled={second === "cancel"} />;
  }
  if (first === "p" && second) {
    const p = await one<any>(
      "SELECT * FROM pages WHERE slug=$1 AND route_prefix='p' AND is_active=true",
      [second],
    );
    if (!p) notFound();
    return (
      <main className="prose-page main-width">
        <span className="eyebrow">EXCPIX</span>
        <h1>{p.title}</h1>
        <small>Updated {new Date(p.updated_at).toLocaleDateString()}</small>
        {p.content.split("\n\n").map((text: string, i: number) => (
          <p key={i}>{text}</p>
        ))}
      </main>
    );
  }
  if (path.length === 1) {
    const directSlug =
      first === "term" || first === "terms"
        ? "terms"
        : first === "privacy" || first === "privacy-policy"
          ? "privacy-policy"
          : first;
    const p = await one<any>(
      "SELECT * FROM pages WHERE slug=$1 AND route_prefix='direct' AND is_active=true",
      [directSlug],
    );
    if (p)
      return (
        <main className="prose-page main-width">
          <span className="eyebrow">EXCPIX</span>
          <h1>{p.title}</h1>
          <small>Updated {new Date(p.updated_at).toLocaleDateString()}</small>
          {p.content.split("\n\n").map((text: string, i: number) => (
            <p key={i}>{text}</p>
          ))}
        </main>
      );
  }
  if (first === "search" && second) {
    const requestedCategory =
      typeof searchQuery.category === "string" &&
      settings.categories.some(
        (category) => category.id === searchQuery.category,
      )
        ? searchQuery.category
        : undefined;
    return (
      <Gallery
        styles={await getStyles(
          requestedCategory,
          decodeURIComponent(second),
          200,
        )}
        term={decodeURIComponent(second)}
        grouped
      />
    );
  }
  if (
    contentKinds.has(first) ||
    settings.categories.some((c) => c.id === first)
  ) {
    const kind = collectionKind(first);
    if (path.length === 1) {
      const content = collectionContent(settings, kind);
      return (
        <>
          <Gallery
            styles={await getStyles(kind, undefined, 10000)}
            kind={kind}
          />
          <div className="main-width">
            <FAQSection items={visibleFAQs(undefined, content)} />
          </div>
        </>
      );
    }
    if (second === "search" && third)
      return (
        <Gallery
          styles={await getStyles(kind, decodeURIComponent(third), 200)}
          kind={kind}
          term={decodeURIComponent(third)}
        />
      );
    if (path.length === 2) {
      const s = await getStyle(kind, second);
      if (!s) notFound();
      const project3d =
        kind === "3d" ? text3dProjectSchema.parse(s.content_json) : undefined;
      const buttonProject =
        kind === "button"
          ? buttonStateSchema.safeParse(s.content_json)
          : undefined;
      await query(
        "ALTER TABLE styles ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0",
        [],
      );
      await query("UPDATE styles SET view_count=view_count+1 WHERE id=$1", [
        s.id,
      ]);
      const related = selectRelated(
        s,
        ["3d-text", "ai", "design", "3d"].includes(kind)
          ? await getStyles(undefined, undefined, 10000)
          : await getStyles(kind, undefined, 10000),
        Number(settings.related_count ?? 30),
      );
      const content = collectionContent(settings, kind);
      const base = process.env.APP_URL || "http://localhost:3000";
      const schema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: s.seo_title || s.title,
        description: s.seo_description || s.description,
        url: base + "/" + first + "/" + second,
        image: new URL(s.image_url || "/previews/" + s.slug + ".png", base)
          .href,
        publisher: { "@type": "Organization", name: "EXCPIX", url: base },
      };
      return (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
            }}
          />
          {project3d ? (
            <Text3DEditor
              key={s.id}
              styleId={s.id}
              initialProject={project3d}
              title={s.title}
              description={s.description}
            />
          ) : buttonProject?.success ? (
            <ButtonEditor
              key={s.id}
              style={s}
              initialState={buttonProject.data}
            />
          ) : kind === "ai" ||
            (first === "text" && s.metadata.source_kind === "ai") ? (
            <AIEditor key={s.id} style={s} />
          ) : (
            <Editor key={s.id} style={s} />
          )}
          <AdSlot position="editor-bottom" />
          <div className="main-width content-sections">
            <HowTo content={content} />
            <FAQSection items={visibleFAQs(s, content)} />
            <Related style={s} styles={related} />
          </div>
        </>
      );
    }
  }
  notFound();
}
