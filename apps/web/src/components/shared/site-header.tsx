import { useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  LogIn,
  LogOut,
  Menu,
  ShoppingBasket,
  Sprout,
  UserRound,
  X,
} from 'lucide-react';
import { Dialog, DropdownMenu } from 'radix-ui';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { logout, type User } from '@/lib/session';
import { cn } from '@/lib/utils';
import { canPurchase } from '@/route-access';
import { NotificationRuntime } from '@/features/notifications/components/notification-runtime';

const activeLink = { className: 'text-primary underline underline-offset-4' };

/**
 * Site header. Below 768px the text links move into a slide-in drawer
 * opened from the menu button; the cart and notifications stay in the bar.
 */
export function SiteHeader({
  user,
  cartCount,
}: {
  user: User | null | undefined;
  cartCount: number;
}) {
  const ordersPath = user?.role === 'producer' ? '/producer/orders' : '/orders';
  const showOrders = Boolean(user && user.role !== 'admin');
  const isProducer = user?.role === 'producer';
  const homePath = isProducer ? '/producer' : '/';

  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Main navigation">
        <div className="flex min-w-0 items-center gap-1">
          <MobileDrawer user={user} />
          <Link to={homePath} className="brand-link">
            <span className="brand-mark hidden! md:grid!">
              <Sprout aria-hidden="true" />
            </span>
            <span>
              From Farm <span className="brand-connector">to</span> Table
            </span>
          </Link>
        </div>
        <div className="site-nav-links">
          <Link
            to={homePath}
            className="hidden md:inline"
            activeOptions={{ exact: true }}
            activeProps={activeLink}
          >
            Home
          </Link>
          {isProducer && (
            <Link
              to="/"
              className="hidden md:inline"
              activeOptions={{ exact: true }}
              activeProps={activeLink}
            >
              Market
            </Link>
          )}
          {isProducer && (
            <Link
              to="/producer/products"
              className="hidden md:inline"
              activeProps={activeLink}
            >
              Products
            </Link>
          )}
          {isProducer ? (
            <Link
              to="/producer/auctions"
              className="hidden md:inline"
              activeProps={activeLink}
            >
              Auctions
            </Link>
          ) : (
            <Link
              to="/auctions"
              search={{ page: 1 }}
              className="hidden md:inline"
              activeProps={activeLink}
            >
              Auctions
            </Link>
          )}
          {canPurchase(user) && (
            <Link
              to="/cart"
              className="inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={
                cartCount > 0
                  ? `Shopping cart with ${cartCount} items`
                  : 'Shopping cart, empty'
              }
            >
              <ShoppingBasket aria-hidden="true" className="size-5 md:size-4" />
              <span className="hidden md:inline">Cart</span>
              {cartCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground tabular-nums">
                  {cartCount}
                </span>
              )}
            </Link>
          )}
          {showOrders && (
            <Link
              to={ordersPath}
              search={{ page: 1 }}
              className="hidden md:inline"
              activeProps={activeLink}
            >
              Orders
            </Link>
          )}
          {user && <NotificationRuntime key={user.id} user={user} />}
          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Link
                to="/login"
                className="hidden md:inline"
                activeProps={{ className: 'nav-active' }}
              >
                Sign in
              </Link>
              <Link to="/register" className="nav-register hidden! md:flex!">
                Sign up <ArrowUpRight aria-hidden="true" />
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

interface DrawerItem {
  label: string;
  to: string;
  search?: { page: number };
  /** Treat sub-paths as active (e.g. order detail under orders). */
  prefix?: boolean;
}

function itemsFor(user: User | null | undefined): DrawerItem[] {
  const marketplace: DrawerItem[] = [
    { label: 'Shop', to: '/' },
    { label: 'Auctions', to: '/auctions', search: { page: 1 }, prefix: true },
  ];
  if (user?.role === 'producer')
    return [
      { label: 'Dashboard', to: '/producer' },
      {
        label: 'Sales',
        to: '/producer/orders',
        search: { page: 1 },
        prefix: true,
      },
      { label: 'Products', to: '/producer/products', prefix: true },
      { label: 'Auctions', to: '/producer/auctions', prefix: true },
      { label: 'Market', to: '/' },
      { label: 'Account', to: '/account' },
    ];
  if (user?.role === 'buyer')
    return [
      ...marketplace,
      { label: 'Cart', to: '/cart' },
      { label: 'Orders', to: '/orders', search: { page: 1 }, prefix: true },
      { label: 'Account', to: '/account' },
    ];
  if (user) return [...marketplace, { label: 'Account', to: '/account' }];
  return marketplace;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

function MobileDrawer({ user }: { user: User | null | undefined }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(location.pathname);
  if (open && openedAt !== location.pathname) {
    setOpenedAt(location.pathname);
    setOpen(false);
  }
  const isActive = (item: DrawerItem) =>
    item.prefix
      ? location.pathname === item.to ||
        location.pathname.startsWith(`${item.to}/`)
      : location.pathname === item.to;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpenedAt(location.pathname);
        setOpen(next);
      }}
    >
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="-ml-2 inline-flex size-10 items-center justify-center rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:hidden"
          aria-label="Open menu"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 drawer-overlay md:hidden" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-80 flex-col bg-background shadow-xl outline-none drawer-panel md:hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <Dialog.Title className="text-base font-semibold tracking-tight">
              From Farm <span className="brand-connector">to</span> Table
            </Dialog.Title>
            <Dialog.Close
              className="-mr-2 inline-flex size-10 items-center justify-center rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label="Close menu"
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Site navigation
          </Dialog.Description>

          {user && (
            <div className="mx-3 mb-2 flex items-center gap-3 rounded-lg border bg-card p-3">
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-primary"
              >
                {initials(user.name)}
              </span>
              <p className="min-w-0 truncate font-semibold">{user.name}</p>
            </div>
          )}

          <nav aria-label="Menu" className="flex-1 overflow-y-auto px-3 pb-3">
            <ul className="mt-2">
              {itemsFor(user).map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    search={item.search}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(item) ? 'page' : undefined}
                    className={cn(
                      'flex items-center rounded-md px-3 py-3 text-[15px] font-medium hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      isActive(item) &&
                        'bg-secondary font-semibold text-primary',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="border-t px-3 py-3">
            {user ? (
              <SignOutButton onDone={() => setOpen(false)} />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Button asChild variant="outline">
                  <Link to="/login" onClick={() => setOpen(false)}>
                    <LogIn aria-hidden="true" /> Sign in
                  </Link>
                </Button>
                <Button asChild>
                  <Link to="/register" onClick={() => setOpen(false)}>
                    Sign up
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function UserMenu({ user }: { user: User }) {
  const signOut = useSignOut();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="hidden items-center gap-2 rounded-lg py-1 pr-2 pl-1 text-[13px] font-medium hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:bg-accent md:inline-flex"
        >
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold text-primary"
          >
            {initials(user.name)}
          </span>
          <span className="max-w-40 truncate">{user.name}</span>
          <ChevronDown aria-hidden="true" className="size-4 opacity-60" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-52 rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md"
        >
          <DropdownMenu.Label className="px-3 pt-2 pb-1.5">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <Link
              to="/account"
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-highlighted:bg-accent"
            >
              <UserRound aria-hidden="true" className="size-4" /> Account
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={signOut.busy}
            onSelect={() => void signOut.run()}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-disabled:opacity-60 data-highlighted:bg-accent"
          >
            <LogOut aria-hidden="true" className="size-4" />
            {signOut.busy ? 'Signing out…' : 'Sign out'}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function useSignOut() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const signingOut = logout();
      await client.cancelQueries();
      client.setQueryData(['session'], null);
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'session',
      });
      await signingOut.catch(() => undefined);
      await navigate({ to: '/' });
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

function SignOutButton({ onDone }: { onDone: () => void }) {
  const signOut = useSignOut();
  return (
    <button
      type="button"
      disabled={signOut.busy}
      onClick={() => {
        onDone();
        void signOut.run();
      }}
      className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-[15px] font-medium hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
    >
      <LogOut aria-hidden="true" className="size-5" />
      {signOut.busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
