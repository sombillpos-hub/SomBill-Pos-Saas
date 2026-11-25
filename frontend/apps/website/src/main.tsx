import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { SITE_CONFIG } from './services/siteConfig';

// Sign-in lives in the dashboards app: /login (and its common aliases) on the website forwards there.
const SIGN_IN_PATHS = new Set(['/login', '/signin', '/sign-in', '/log-in', '/dashboard', '/app']);
const currentPath = window.location.pathname.replace(/\/+$/, '').toLowerCase() || '/';
if (SIGN_IN_PATHS.has(currentPath)) window.location.replace(SITE_CONFIG.signInUrl);
else createRoot(document.getElementById('root')!).render(<App />);
