import { useState } from 'react';
import { ArrowUpRight, Menu, ShoppingBasket, Sprout, X } from 'lucide-react';
import { Link, useLocation } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import type { User } from '@/lib/session';
import { canPurchase } from '@/route-access';
import { NotificationRuntime } from '@/features/notifications/components/notification-runtime';

const activeLink = { className: 'text-primary underline underline-offset-4' };
const menuLink = 'block rounded-md px-2 py-3 hover:bg-accent';

/**
 * Site header. Below 768px the text links collapse into a menu panel;
 * the cart and notifications stay in the bar.
 */
export function SiteHeader({
  user,
  cartCount,
}: {
  user: User | null | undefined;
  cartCount: number;
}) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(location.pathname);
  if (menuPath !== location.pathname) {
    setMenuPath(location.pathname);
    setMenuOpen(false);
  }
  const ordersPath = user?.role === 'producer' ? '/producer/orders' : '/orders';
  const accountPath = user?.role === 'producer' ? '/producer' : '/account';
  const showOrders = Boolean(user && user.role !== 'admin');

  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Main navigation">
        <Link to="/" className="brand-link">
          <span className="brand-mark">
            <Sprout aria-hidden="true" />
          </span>
          <span>
            From Farm <span className="brand-connector">to</span> Table
          </span>
        </Link>
        <div className="site-nav-links">
          <Link to="/" className="hidden md:inline">
            Home
          </Link>
          <Link
            to="/auctions"
            search={{ page: 1 }}
            className="hidden md:inline"
            activeProps={activeLink}
          >
            Auctions
          </Link>
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
            <Link to={accountPath} className="hidden md:inline">
              My account
            </Link>
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
          <button
            type="button"
            className="-mr-2 inline-flex size-10 items-center justify-center rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X aria-hidden="true" className="size-5" />
            ) : (
              <Menu aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
      </nav>
      {menuOpen && (
        <div
          id="mobile-menu"
          className="border-t border-border px-4 pb-4 md:hidden"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setMenuOpen(false);
          }}
        >
          <ul className="flex flex-col py-2 text-base">
            <li>
              <Link to="/" className={menuLink}>
                Home
              </Link>
            </li>
            <li>
              <Link to="/auctions" search={{ page: 1 }} className={menuLink}>
                Auctions
              </Link>
            </li>
            {showOrders && (
              <li>
                <Link to={ordersPath} search={{ page: 1 }} className={menuLink}>
                  Orders
                </Link>
              </li>
            )}
            {user && (
              <li>
                <Link to={accountPath} className={menuLink}>
                  My account
                </Link>
              </li>
            )}
          </ul>
          {!user && (
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <Button asChild variant="outline">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
