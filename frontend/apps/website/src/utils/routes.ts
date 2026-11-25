export type ProductSlug =
  | 'restaurant-pos'
  | 'nfc-ordering'
  | 'qr-ordering'
  | 'table-management'
  | 'menu-management'
  | 'kds'
  | 'order-management'
  | 'inventory-management'
  | 'staff-management'
  | 'billing-payments'
  | 'tax-financial-reports'
  | 'multi-branch'
  | 'business-analytics';

export type SolutionSlug =
  'restaurants' | 'cafes' | 'fast-food' | 'hotels' | 'food-trucks' | 'multi-branch-chains' | 'bakery-pastry';

export type ResourceSlug =
  'blog' | 'help-center' | 'documentation' | 'video-tutorials' | 'faqs' | 'case-studies' | 'product-updates';

export type CompanySlug = 'about' | 'why-sombill' | 'contact' | 'partners' | 'careers' | 'become-partner';

export type WebsitePageRoute =
  | { type: 'home' }
  | { type: 'pricing' }
  | { type: 'product'; slug: ProductSlug }
  | { type: 'solution'; slug: SolutionSlug }
  | { type: 'resource'; slug: ResourceSlug }
  | { type: 'company'; slug: CompanySlug };

const PRODUCT_SLUGS: ProductSlug[] = [
  'restaurant-pos',
  'nfc-ordering',
  'qr-ordering',
  'table-management',
  'menu-management',
  'kds',
  'order-management',
  'inventory-management',
  'staff-management',
  'billing-payments',
  'tax-financial-reports',
  'multi-branch',
  'business-analytics',
];

const SOLUTION_SLUGS: SolutionSlug[] = [
  'restaurants',
  'cafes',
  'fast-food',
  'hotels',
  'food-trucks',
  'multi-branch-chains',
  'bakery-pastry',
];

const RESOURCE_SLUGS: ResourceSlug[] = [
  'blog',
  'help-center',
  'documentation',
  'video-tutorials',
  'faqs',
  'case-studies',
  'product-updates',
];

const COMPANY_SLUGS: CompanySlug[] = ['about', 'why-sombill', 'contact', 'partners', 'careers', 'become-partner'];

export function routeToPathname(route: WebsitePageRoute): string {
  if (route.type === 'pricing') return '/pricing';
  if (route.type === 'company' && route.slug === 'contact') return '/contact';
  if (route.type === 'company') return `/${route.slug}`;
  if (route.type === 'product') return `/product/${route.slug}`;
  if (route.type === 'solution') return `/solution/${route.slug}`;
  if (route.type === 'resource') return `/resources/${route.slug}`;
  return '/';
}

export function pathnameToRoute(pathname: string): WebsitePageRoute {
  const clean = (pathname || '/').replace(/\/+$/, '') || '/';
  if (clean === '/' || clean === '/home') return { type: 'home' };
  if (clean === '/pricing') return { type: 'pricing' };
  if (clean === '/contact') return { type: 'company', slug: 'contact' };

  const maybeCompany = clean.slice(1) as CompanySlug;
  if (COMPANY_SLUGS.includes(maybeCompany)) {
    return { type: 'company', slug: maybeCompany };
  }

  if (clean.startsWith('/product/')) {
    const slug = clean.replace('/product/', '') as ProductSlug;
    if (PRODUCT_SLUGS.includes(slug)) return { type: 'product', slug };
  }

  if (clean.startsWith('/solution/')) {
    const slug = clean.replace('/solution/', '') as SolutionSlug;
    if (SOLUTION_SLUGS.includes(slug)) return { type: 'solution', slug };
  }

  if (clean.startsWith('/resources/')) {
    const slug = clean.replace('/resources/', '') as ResourceSlug;
    if (RESOURCE_SLUGS.includes(slug)) return { type: 'resource', slug };
  }

  return { type: 'home' };
}
