import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const linkClass =
  'text-sm text-background/80 transition-colors hover:text-background focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-background/60 focus-visible:outline-none';

function Column({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <h2 className="font-sans text-xs font-semibold tracking-wider uppercase">
        {title}
      </h2>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

/**
 * Transparent PNG logos in public/images/payments (sources in CREDITS.md).
 * `mono` logos are dark on their own, so they render as white on the footer.
 */
const payments = [
  { label: 'Visa', file: 'visa.png', mono: true },
  { label: 'Mastercard', file: 'mastercard.png', mono: false },
  { label: 'Multibanco', file: 'multibanco.png', mono: true },
  { label: 'Google Pay', file: 'googlepay.png', mono: true },
  { label: 'Apple Pay', file: 'applepay.png', mono: true },
] as const;

/** Simple line marks drawn for this footer (not the official brand assets). */
const socials = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/',
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
      </>
    ),
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/',
    icon: (
      <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z" />
    ),
  },
  {
    label: 'X (Twitter)',
    href: 'https://x.com/',
    icon: (
      <>
        <path d="M4 4h4.5L20 20h-4.5z" />
        <path d="M20 4l-6.5 7.2M10.5 12.8 4 20" />
      </>
    ),
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/',
    icon: (
      <path d="M13 3h3a4.5 4.5 0 0 0 4 4v3a7.5 7.5 0 0 1-4-1.2V15a6 6 0 1 1-6-6v3a3 3 0 1 0 3 3z" />
    ),
  },
] as const;

/** Site-wide footer; internal links only go to routes that exist. */
export function SiteFooter() {
  return (
    <footer className="mt-16 bg-foreground text-background">
      <div className="mx-auto max-w-[1440px] px-4 pt-12 pb-8 md:px-8 xl:px-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 md:gap-x-10">
          <div className="col-span-2 flex flex-col">
            <p className="font-[family-name:var(--font-editorial)] text-2xl md:text-3xl">
              From Farm to Table
            </p>
            <p className="mt-4 text-base leading-relaxed text-background/80">
              Local producers, fresh food and live auctions in one market. Buy
              direct from the people who grow it.
            </p>
            <div className="mt-auto flex flex-wrap items-end gap-x-4 gap-y-3 pt-6">
              <p className="text-xs leading-none font-semibold tracking-wider uppercase">
                Secured by
              </p>
              <ul className="flex flex-wrap items-end gap-x-3.5 gap-y-3">
                {payments.map(({ label, file, mono }) => (
                  <li key={label} className="flex h-5 items-end">
                    <img
                      src={`/images/payments/${file}`}
                      alt={label}
                      loading="lazy"
                      className={cn(
                        'h-full w-auto object-contain',
                        label === 'Visa' && 'h-3',
                        label === 'Google Pay' && 'h-4',
                        mono && 'brightness-0 invert',
                      )}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Column title="Explore" className="md:justify-self-center">
            <li>
              <Link to="/products" className={linkClass}>
                Products
              </Link>
            </li>
            <li>
              <Link to="/auctions" search={{ page: 1 }} className={linkClass}>
                Auctions
              </Link>
            </li>
            <li>
              <Link to="/register" className={linkClass}>
                Sell with us
              </Link>
            </li>
          </Column>
          <div className="md:justify-self-center">
            <h2 className="font-sans text-xs font-semibold tracking-wider uppercase">
              Follow us
            </h2>
            <ul className="mt-4 flex gap-2">
              {socials.map(({ label, href, icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${label} (opens in a new tab)`}
                    className="inline-flex size-10 items-center justify-center rounded-md border border-background/20 text-background/80 transition-colors hover:border-background/50 hover:text-background focus-visible:ring-2 focus-visible:ring-background/60 focus-visible:outline-none"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="size-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {icon}
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3 border-t border-background/15 pt-6 text-sm text-background/70 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} From Farm to Table.</p>
          <p>Local farmers. Real food. Stronger communities.</p>
        </div>
      </div>
    </footer>
  );
}
