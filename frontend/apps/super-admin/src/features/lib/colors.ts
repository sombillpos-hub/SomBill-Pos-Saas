/** Branch colours in order: crimson, orange, amber, violet, then emerald, sky, rose, lime for larger groups. */
export const BRANCH_COLORS = ['#dc2626', '#f97316', '#fbbf24', '#8b5cf6', '#10b981', '#38bdf8', '#e11d48', '#84cc16'];
export const branchColor = (i: number) => BRANCH_COLORS[i % BRANCH_COLORS.length] as string;
