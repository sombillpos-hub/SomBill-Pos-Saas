import { Link } from 'react-router-dom';
import { roleHome, useAuth } from '@sombill/shared-hooks/AuthContext';
import { EmptyState } from '@sombill/shared-ui/ui/Feedback';
import { Button } from '@sombill/shared-ui/ui/Button';

export function NotFoundPage() {
  const { role } = useAuth();
  const home = roleHome(role);

  return (
    <div className="card">
      <EmptyState
        title="Page not found"
        message="The page you are looking for doesn’t exist or was moved."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link to={home}>
              <Button variant="primary">Back to dashboard</Button>
            </Link>
            <a href="/">
              <Button variant="secondary">Visit SomBill Website</Button>
            </a>
          </div>
        }
      />
    </div>
  );
}
