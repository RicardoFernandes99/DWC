import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { currentUser } from '@/lib/session';
import { NotificationInbox } from './notification-inbox';

export function NotificationPage() {
  const session = useQuery({
    queryKey: ['session'],
    queryFn: currentUser,
    retry: false,
  });
  if (session.isPending)
    return (
      <main className="notification-page" role="status">
        Restoring your session…
      </main>
    );
  if (session.error || !session.data)
    return (
      <main className="notification-page">
        <h1>Notifications are unavailable</h1>
        <p>Please sign in to view your updates.</p>
        <Button asChild variant="outline">
          <Link to="/login">Sign in</Link>
        </Button>
      </main>
    );
  return <NotificationInbox user={session.data} />;
}
