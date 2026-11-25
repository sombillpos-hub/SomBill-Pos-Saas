import {
  PRODUCT_PAGES,
  SOLUTION_PAGES,
  type CompanySlug,
  type ProductSlug,
  type ResourceSlug,
  type SolutionSlug,
  type WebsitePageRoute,
} from './websiteData';

const RESOURCE_SLUGS: readonly ResourceSlug[] = [
  'blog',
  'help-center',
  'documentation',
  'video-tutorials',
  'faqs',
  'case-studies',
  'product-updates',
];
const COMPANY_SLUGS: readonly CompanySlug[] = [
  'about',
  'why-sombill',
  'contact',
  'partners',
  'careers',
  'become-partner',
];

/** Maps a URL path to a website page. Only known slugs match; anything else is the home page. */
export function parsePathname(pathname: string): WebsitePageRoute {
  const p = (pathname || '/').replace(/\/+$/, '').toLowerCase() || '/';
  if (p === '/' || p === '/home') return { type: 'home' };
  if (p === '/pricing') return { type: 'pricing' };
  const [, first = '', second = ''] = p.split('/');
  if (!second && (COMPANY_SLUGS as readonly string[]).includes(first))
    return { type: 'company', slug: first as CompanySlug };
  if (first === 'product' && second in PRODUCT_PAGES) return { type: 'product', slug: second as ProductSlug };
  if (first === 'solution' && second in SOLUTION_PAGES) return { type: 'solution', slug: second as SolutionSlug };
  if (first === 'resources' && (RESOURCE_SLUGS as readonly string[]).includes(second))
    return { type: 'resource', slug: second as ResourceSlug };
  return { type: 'home' };
}
