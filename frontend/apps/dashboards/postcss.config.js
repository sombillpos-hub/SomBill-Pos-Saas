import { fileURLToPath } from 'node:url';

// The Tailwind config is named explicitly so it is found no matter which folder the dev server is started from
// (`npm run dev` in frontend/ runs the dashboards from the frontend folder, not from apps/dashboards).
const tailwindConfig = fileURLToPath(new URL('./tailwind.config.js', import.meta.url));

export default { plugins: { tailwindcss: { config: tailwindConfig }, autoprefixer: {} } };
