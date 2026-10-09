import { one, query } from "./db";
import { defaultPlans, defaultSettings } from "./defaults";
import { calendar2027Style } from "./design-seeds";
import type { Settings, Style, Plan } from "./types";

export async function getSettings() {
  const settings = {
    ...defaultSettings,
    announcement_url: "",
    announcement_link_text: "",
    home_style_count: 30,
    related_count: 30,
    collection_content: {},
    ...((
      await one<{ value: Settings }>(
        "SELECT value FROM settings WHERE key='site'",
      )
    )?.value ?? defaultSettings),
  };
  settings.categories = settings.categories.filter(
    (category) => !["blog", "prompt", "svg-text"].includes(category.id),
  );
  settings.categories = settings.categories.map((category) =>
    category.id === "ai" && category.name === "AI Lettering"
      ? { ...category, name: "AI Design" }
      : category,
  );
  if (!settings.categories.some((category) => category.id === "visual"))
    settings.categories.push({ id: "visual", name: "Visual" });
  return settings;
}
export async function getPlans() {
  const plans = (
    await query<{ data: Plan }>(
      "SELECT data FROM plans ORDER BY (data->>'price')::numeric",
    )
  ).map((r) => r.data);
  const defaultPro = defaultPlans.find((plan) => plan.id === "pro");
  const defaultStudio = defaultPlans.find((plan) => plan.id === "studio");
  return plans.map((plan) => {
    if (plan.id === "studio" && defaultStudio) {
      return {
        ...plan,
        ...(plan.price === 699
          ? { price: defaultStudio.price, yearly_price: defaultStudio.yearly_price }
          : {}),
        regional_prices: [
          ...(plan.regional_prices || []),
          ...(defaultStudio.regional_prices || []).filter(
            (price) => !(plan.regional_prices || []).some((current) => current.currency === price.currency),
          ),
        ],
      };
    }
    if (plan.id !== "pro" || !defaultPro) return plan;
    const regional = plan.regional_prices || [];
    const existingCurrencies = new Set(regional.map((price) => price.currency));
    return {
      ...plan,
      ...(plan.price === 299
        ? { price: defaultPro.price, yearly_price: defaultPro.yearly_price }
        : {}),
      regional_prices: [
        ...regional,
        ...(defaultPro.regional_prices || []).filter(
          (price) => !existingCurrencies.has(price.currency),
        ),
      ],
    };
  });
}
export async function getStyles(kind?: string, term?: string, limit = 60) {
  const args: unknown[] = [];
  let where =
    "is_active=true AND status='approved' AND kind NOT IN ('blog','prompt')";
  if (kind) {
    args.push(kind);
    where += ` AND kind=$${args.length}`;
  }
  if (term) {
    args.push(`%${term.replace(/[%_]/g, "")}%`);
    where += ` AND (title ILIKE $${args.length} OR style_category ILIKE $${args.length} OR tags::text ILIKE $${args.length})`;
  }
  args.push(limit);
  return query<Style>(
    `SELECT * FROM styles WHERE ${where} ORDER BY created_at,id LIMIT $${args.length}`,
    args,
  );
}
export async function getStyle(kind: string, slug: string) {
  if (kind === "design" && slug === calendar2027Style.slug) {
    await query(
      "UPDATE styles SET content_json=$1,metadata=COALESCE(metadata,'{}'::jsonb)||$2::jsonb WHERE kind='design' AND slug=$3 AND COALESCE(metadata->>'layout_revision','')<>$4",
      [
        JSON.stringify(calendar2027Style.content_json),
        JSON.stringify({ layout_revision: "calendar-grid-v2" }),
        calendar2027Style.slug,
        "calendar-grid-v2",
      ],
    );
  }
  return one<Style>(
    "SELECT * FROM styles WHERE kind=$1 AND kind NOT IN ('blog','prompt') AND slug=$2 AND is_active=true AND status='approved'",
    [kind, slug],
  );
}
