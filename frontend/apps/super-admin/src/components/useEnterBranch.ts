import { useNavigate } from 'react-router-dom';
import { useAuth } from '@sombill/shared-hooks/AuthContext';
import { useToast } from '@sombill/shared-ui/ui/Toast';
import { friendlyError } from '@sombill/api-client/supabase';

/** Opens the Manager dashboard of one branch. The owner acts as that branch's manager until they return to HQ. */
export function useEnterBranch() {
  const { enterBranch } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  return async (restaurantId: string, to = '/manager') => {
    try {
      await enterBranch(restaurantId);
      navigate(to);
    } catch (e) {
      toast.error(friendlyError(e));
    }
  };
}
