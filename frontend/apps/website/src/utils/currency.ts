export type Language = 'en' | 'so';

export const DEFAULT_EXCHANGE_RATE = 11801; // $1 USD = 11,801 SLSH

export function convertUsdToSlsh(usd: number, rate: number = DEFAULT_EXCHANGE_RATE): number {
  return Math.round(usd * rate);
}

export function formatUsd(usd: number, showCents = false): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(usd);
}

export function formatSlsh(usd: number, rate: number = DEFAULT_EXCHANGE_RATE): string {
  const slsh = convertUsdToSlsh(usd, rate);
  return `${new Intl.NumberFormat('en-US').format(slsh)} SLSH`;
}

export function formatDualCurrency(
  usd: number,
  rate: number = DEFAULT_EXCHANGE_RATE,
  showCents = false,
): { usd: string; slsh: string } {
  return {
    usd: formatUsd(usd, showCents),
    slsh: formatSlsh(usd, rate),
  };
}
