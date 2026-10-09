export type Role = "owner" | "admin" | "moderator" | "support" | "user";
export type User = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  plan: string;
  plan_expires: string | null;
  permissions: string[];
  created_at: string;
};
export type Stop = { color: string; pos: number };
export interface Fill {
  type: string;
  color: string;
  opacity: number;
  angle: number;
  stops: Stop[];
  scope?: string;
  altScope?: string;
  altMode?: string;
  colors?: string[];
  altGradients?: { c1: string; c2: string; angle: number }[];
  patternBase64?: string | null;
  patternSize?: number;
  patternRepeat?: string;
  patternBgType?: string;
  patternBgColor?: string;
  patternBgStops?: Stop[];
  patternBgAngle?: number;
  altImages?: unknown[];
  [key: string]: unknown;
}
export interface Layer extends Fill {
  id: number;
  layerType: string;
  enabled: boolean;
  size: number;
  width: number;
  blur?: number;
  offsetX?: number;
  offsetY?: number;
}
export interface EditorState {
  text: string;
  fontFamily: string;
  fontBase64?: string;
  fontAssetId?: string;
  letterSpacing: number;
  lineHeight: number;
  align: string;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  rotation: number;
  curve: number;
  zigzag: number;
  wave: number;
  animation: { id: string; speed: number };
  fill: Fill;
  layers: Layer[];
  bg: Fill & { base64?: string | null; imageMode?: string };
}
export interface Style {
  id: string;
  slug: string;
  kind: string;
  title: string;
  description: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string[];
  image_url: string;
  image_alt: string;
  style_category: string;
  tags: string[];
  metadata: Record<string, unknown>;
  content_json: EditorState;
  is_free: boolean;
  is_premium: boolean;
  is_active: boolean;
  is_locked: boolean;
  badge: string;
  download_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  submitted_by?: string;
  status: string;
}
export interface RegionalPrice {
  country: string;
  currency: string;
  price: number;
  yearly_price: number;
  active: boolean;
  gateways: string[];
}
export interface Plan {
  id: string;
  name: string;
  price: number;
  yearly_price: number;
  currency: string;
  download_limit: number;
  max_quality: number;
  features: string[];
  active: boolean;
  regional_prices?: RegionalPrice[];
  gateways?: string[];
}
export interface Settings {
  site_name: string;
  description: string;
  header_links: { label: string; href: string }[];
  categories: { id: string; name: string }[];
  badges: string[];
  ads_enabled: boolean;
  ad_client: string;
  ad_slots: {
    position: string;
    slot: string;
    enabled: boolean;
    manual_enabled?: boolean;
    manual_html?: string;
    manual_css?: string;
    manual_js?: string;
  }[];
  ad_disabled_pages: string[];
  maintenance: boolean;
  announcement: string;
  free_download_limit: number;
  watermark: string;
  social_handle: string;
  billing_periods: string[];
  footer_description?: string;
  footer_columns?: {
    title: string;
    links: { label: string; href: string }[];
  }[];
  footer_copyright?: string;
  footer_tagline?: string;
  [key: string]: unknown;
}
