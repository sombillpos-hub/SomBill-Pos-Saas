// Imported first in main.tsx so a temporary session is cleared before the Supabase client reads storage.
import { enforceTemporarySession } from './session';

enforceTemporarySession();
