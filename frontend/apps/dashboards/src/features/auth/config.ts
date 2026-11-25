/** Deployment-specific details for the sign-in screen. Override with VITE_* variables; defaults come from the public website. */
const env = import.meta.env as Record<string, string | undefined>;

const digits = (s: string) => s.replace(/\D/g, '');

export const authConfig = {
  supportEmail: env.VITE_SUPPORT_EMAIL || 'support@sombill.com',
  supportWhatsapp: digits(env.VITE_SUPPORT_WHATSAPP || '+252 63 440 8910'),
  /** A customer-facing menu page. The link is hidden until a URL is configured. */
  publicMenuUrl: env.VITE_PUBLIC_MENU_URL || '',
  /** Needs the Google provider enabled in Supabase Auth. Hidden otherwise, so there is never a dead button. */
  googleEnabled: env.VITE_AUTH_GOOGLE === 'true',
  emailDomains: ['gmail.com', 'outlook.com', 'sombill.com'],
  /** Supabase allows one auth email per 60 seconds per address by default. */
  resendSeconds: 60,
};

export const supportHref = () =>
  authConfig.supportWhatsapp
    ? `https://wa.me/${authConfig.supportWhatsapp}`
    : `mailto:${authConfig.supportEmail}?subject=SomBill%20support`;
