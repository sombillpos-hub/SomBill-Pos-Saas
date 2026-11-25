import { supabase, unwrap } from './supabase';

/** Creates a restaurant group for the signed-in manager and returns its id (used by Manager > Settings > Group HQ). */
export async function createOrganization(name: string): Promise<string> {
  return unwrap(await supabase.rpc('create_organization', { p_name: name })) as string;
}
