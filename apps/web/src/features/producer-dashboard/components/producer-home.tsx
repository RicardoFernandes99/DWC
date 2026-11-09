import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';
import { Gavel, Plus, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sessionOptions } from '@/lib/session-query';
import { ProducerOnboarding } from '@/features/producer-onboarding/components/producer-onboarding';
import { ProducerProducts } from '@/features/producer-products/components/producer-products';
import { ProducerDashboard } from './producer-dashboard';

/** Producer home: dashboard for approved/suspended producers, onboarding otherwise. */
export function ProducerHome() {
  const session = useQuery(sessionOptions);
  const pathname = useLocation({ select: (location) => location.pathname });
  const user = session.data;
  if (!user)
    return (
      <main className="mx-auto max-w-5xl px-4 py-16" role="status">
        Restoring your session…
      </main>
    );
  const active =
    user.producerStatus === 'approved' || user.producerStatus === 'suspended';
  // Product create/edit pages show only the editor.
  const editing = /^\/producer\/products\/(new|[^/]+\/edit)\/?$/.test(pathname);
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 md:px-8 md:py-10 xl:px-12">
      {!active ? (
        <ProducerOnboarding
          key={user.id}
          user={user}
          requestedSellingPath={
            pathname.startsWith('/producer/') ? pathname : undefined
          }
        />
      ) : editing ? (
        <ProducerProducts status={user.producerStatus} />
      ) : (
        <>
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{user.name}</p>
              <h1 className="text-3xl md:text-4xl">Dashboard</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/producer/orders" search={{ page: 1 }}>
                  <ReceiptText aria-hidden="true" /> Sales
                </Link>
              </Button>
              {user.producerStatus === 'approved' && (
                <>
                  <Button asChild variant="outline">
                    <Link to="/producer/auctions/new">
                      <Gavel aria-hidden="true" /> Create auction
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link to="/producer/products/new">
                      <Plus aria-hidden="true" /> Add product
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </header>
          {user.producerStatus === 'suspended' && (
            <p
              role="status"
              className="mt-4 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm"
            >
              Your selling account is suspended. See your account for details.
            </p>
          )}
          <ProducerDashboard canEdit={user.producerStatus === 'approved'} />
          <ProducerProducts status={user.producerStatus} />
        </>
      )}
    </main>
  );
}
