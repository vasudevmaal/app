import type { CollectionContent, FAQ } from '@/lib/content';

export function FAQSection({ items }: { items: FAQ[] }) {
  if (!items.length) return null;
  const schema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) };
  return <section className="faq-section"><h2>Frequently asked questions</h2>{items.map((item, i) => <details key={i}><summary>{item.question}</summary><p>{item.answer}</p></details>)}<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} /></section>;
}
export function HowTo({ content }: { content: CollectionContent }) {
  if (!content.how_to_enabled || !content.how_to.length) return null;
  return <section className="how-to-section"><h2>How it works</h2><ol>{content.how_to.map((step, i) => <li key={i}><span>{String(i + 1).padStart(2, '0')}</span><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol></section>;
}

const seoCopy: Record<string, { title: string; description: string }> = {
  home: {
    title: 'Build your next creative idea with EXCPIX',
    description: 'Explore ready-to-use 3D Text styles, AI Design inspiration and practical creative resources in one workspace. Discover expressive typography, fresh visual ideas and polished assets for social posts, branding, thumbnails, posters and digital projects.',
  },
  '3d-text': {
    title: 'Create bold 3D Text designs with EXCPIX',
    description: 'Explore dimensional 3D Text styles with expressive lettering, extruded depth, gradients, bevels, shadows and polished finishes. Customize typography for logos, posters, thumbnails, social content and other projects that need a strong visual presence.',
  },
  '3d': {
    title: 'Explore 3D creative tools',
    description: 'Browse editable 3D tools and ready-to-use creative experiences for expressive lettering and visual projects.',
  },
  ai: {
    title: 'Explore expressive AI Design ideas',
    description: 'Discover AI Design styles made for fast creative exploration, striking compositions and memorable visual direction. Find inspiration for artwork, campaigns, social posts and digital projects, then refine the details into a finished design.',
  },
  design: {
    title: 'Find flexible design resources for every project',
    description: 'Browse creative Design styles for posters, branding, social graphics, campaigns and everyday visual work. Explore polished layouts and practical inspiration that help you shape a clear idea into a finished, editable design.',
  },
  visual: {
    title: 'Discover downloadable Visual assets',
    description: 'Explore downloadable Visual resources including illustrations, watercolor artwork and creative image assets. Find the right visual for your project, download it in a useful format or open it in design to continue editing.',
  },
};

export function CategorySeo({ kind = 'home', content }: { kind?: string; content?: CollectionContent }) {
  const copy = seoCopy[kind] || seoCopy.home;
  const title = content?.footer_title?.trim() || copy.title;
  const description = content?.footer_description?.trim() || copy.description;
  return <div className="catalog-seo-copy"><h2>{title}</h2><p>{description}</p></div>;
}
