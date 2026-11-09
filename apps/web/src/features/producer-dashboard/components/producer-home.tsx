import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';
import { Gavel, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sessionOptions } from '@/lib/session-query';
import { ProducerOnboarding } from '@/features/producer-onboarding/components/producer-onboarding';
import { ProducerProducts } from '@/features/producer-products/components/producer-products';
import { AttentionBanner, ProducerDashboard } from './producer-dashboard';

const todayFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function greeting() {
  const hour = new Date().getHours();
  return hour < 12
    ? 'Good morning'
    : hour < 18
      ? 'Good afternoon'
      : 'Good evening';
}

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
          <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-5">
            <div>
              <p className="text-sm text-muted-foreground">
                {todayFormatter.format(new Date())}
              </p>
              <h1 className="text-3xl md:text-4xl">
                {greeting()}, {user.name}
              </h1>
            </div>
            {user.producerStatus === 'approved' && (
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link to="/producer/auctions/new">
                    <Gavel aria-hidden="true" /> New auction
                  </Link>
                </Button>
                <Button asChild>
                  <Link to="/producer/products/new">
                    <Plus aria-hidden="true" /> Add product
                  </Link>
                </Button>
              </div>
            )}
          </header>
          <div className="mt-5">
            <AttentionBanner />
          </div>
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
