import { useCallback } from 'react';
import { supabase, unwrap } from '@sombill/api-client/supabase';
import type { Profile, RestaurantMember } from '@sombill/shared-types/types';
import { useQuery } from './useQuery';

export interface StaffEntry extends RestaurantMember {
  profile: Profile | null;
}

/** All members of the restaurant with their profiles; `nameOf` resolves ids to names. */
export function useStaffDirectory(restaurantId: string) {
  const q = useQuery(async () => {
    const members = unwrap(
      await supabase.from('restaurant_members').select('*').eq('restaurant_id', restaurantId),
    ) as RestaurantMember[];
    const ids = members.map((m) => m.user_id);
    const profiles = ids.length ? (unwrap(await supabase.from('profiles').select('*').in('id', ids)) as Profile[]) : [];
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return members.map((m) => ({ ...m, profile: byId.get(m.user_id) ?? null })) as StaffEntry[];
  }, [restaurantId]);
  const nameOf = useCallback(
    (uid: string | null | undefined) => {
      if (!uid) return '—';
      const e = q.data?.find((s) => s.user_id === uid);
      return e?.profile?.full_name || e?.profile?.email || 'Former staff';
    },
    [q.data],
  );
  return { ...q, nameOf };
}
