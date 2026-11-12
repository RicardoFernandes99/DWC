import { safeReturn } from './safe-return';
import { ProducerStatusBadge } from '@/features/producer-onboarding/components/producer-status-badge';
import { routeAccess } from './route-access';
import { useState } from 'react';
import { ArrowRight, Leaf, LogOut, ShoppingBasket, Sprout } from 'lucide-react';
import { useForm } from '@tanstack/react-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useSearch,
} from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { PaymentMethods } from '@/features/payment-methods/components/payment-methods';
import { ProducerOnboarding } from '@/features/producer-onboarding/components/producer-onboarding';
import { ProducerProfileEditor } from '@/features/producer-products/components/producer-products';
import {
  ApiError,
  login,
  logout,
  currentUser,
  register,
  type User,
} from '@/lib/session';
import { sessionOptions } from './lib/session-query';
import { useCart } from '@/features/cart/use-cart';
import { SiteHeader } from '@/components/shared/site-header';
import { SiteFooter } from '@/components/shared/site-footer';
import { AvatarPicker } from '@/components/shared/avatar-picker';
import './pages.css';

const sessionKey = ['session'] as const;
export function Shell() {
  const { totalItemCount } = useCart();
  const query = useQuery(sessionOptions);
  const location = useLocation();
  // A failed session lookup counts as signed out, so protected routes redirect
  // to sign-in rather than leaving a "could not restore" placeholder.
  const access =
    query.data === undefined && !query.isError
      ? 'allow'
      : routeAccess(location.pathname, query.data ?? null);
  const changingAuth =
    location.pathname === '/login' || location.pathname === '/register';
  return (
    // Column layout keeps the footer at the bottom on short pages.
    <div className="flex min-h-svh flex-col">
      <SiteHeader user={query.data} cartCount={totalItemCount} />
      {query.data?.role === 'buyer' &&
        query.data.buyerStatus === 'suspended' && (
          <section
            className="mx-auto mt-4 max-w-5xl px-6"
            aria-live="polite"
            aria-label="Account suspension"
          >
            <div className="rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm">
              <h2 className="font-semibold">Purchases and bids are paused</h2>
              <p className="mt-1">
                You can still manage your account, saved cards, orders, reviews
                and notifications. Your cart is saved.
              </p>
              {query.data.buyerSuspensionReason && (
                <p className="mt-2 text-muted-foreground">
                  Reason: {query.data.buyerSuspensionReason}
                </p>
              )}
            </div>
          </section>
        )}
      <div className="flex-1">
        {!changingAuth && access === 'home' ? (
          <Navigate to="/" replace />
        ) : access === 'login' ? (
          <Navigate to="/login" search={{ returnTo: location.href }} replace />
        ) : (
          <Outlet />
        )}
      </div>
      {!changingAuth && <SiteFooter />}
    </div>
  );
}
export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false });
  const [error, setError] = useState('');
  const [created, setCreated] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [nameError, setNameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'buyer' as 'buyer' | 'producer',
    },
    onSubmit: async ({ value }) => {
      setError('');
      setEmailError('');
      setNameError('');
      setPasswordError('');
      if (mode === 'register' && !value.name.trim()) {
        setNameError('Enter your name.');
        document.getElementById('name')?.focus();
        return;
      }
      const passwordBytes = new TextEncoder().encode(value.password).length;
      if (mode === 'register' && (passwordBytes < 8 || passwordBytes > 72)) {
        setPasswordError('Password must be between 8 and 72 characters.');
        document.getElementById('password')?.focus();
        return;
      }
      let accountCreated = false;
      try {
        if (mode === 'register') {
          await register(value);
          accountCreated = true;
        }
        const signedIn = await login({
          email: value.email,
          password: value.password,
        });
        await queryClient.cancelQueries();
        queryClient.removeQueries({
          predicate: (query) => query.queryKey[0] !== sessionKey[0],
        });
        queryClient.setQueryData(sessionKey, signedIn);
        void queryClient.invalidateQueries({ queryKey: sessionKey });
        await navigate({
          href:
            safeReturn(search.returnTo, signedIn) ??
            (signedIn.role === 'producer' ? '/producer' : '/account'),
        });
      } catch (err) {
        if (accountCreated) {
          setCreated(true);
          return;
        }
        if (err instanceof ApiError && err.status === 409) {
          setEmailError('An account already uses this email.');
          document.getElementById('email')?.focus();
        } else if (err instanceof ApiError && err.status === 401) {
          setError('Email or password is incorrect.');
          document.getElementById('email')?.focus();
        } else
          setError(err instanceof Error ? err.message : 'Please try again.');
      }
    },
  });
  return (
    <main className="auth-layout" data-mode={mode}>
      <aside className="auth-story" aria-label="From Farm to Table">
        <img
          src="/images/countryside.jpg"
          alt="Sunlight over green fields and rolling countryside"
          width="1400"
          height="933"
          className="auth-story-image"
          fetchPriority="high"
        />
        <div className="auth-story-content">
          <span className="auth-story-symbol">
            <Leaf aria-hidden="true" />
          </span>
          <h2>
            Good things
            <br />
            grow close
            <br />
            <em>to home.</em>
          </h2>
          <p>
            A place for local produce and the people
            <br className="hidden xl:block" /> who make it possible.
          </p>
          <div className="auth-story-footer" aria-hidden="true" />
        </div>
      </aside>
      <section className="auth-form-side" aria-labelledby="auth-title">
        <div className="auth-form-content">
          <h1 id="auth-title" className="auth-title">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="auth-intro">
            {mode === 'login'
              ? 'A little closer to your local community.'
              : 'Your local community starts here.'}
          </p>
          {created ? (
            <div className="mt-8 rounded-lg border p-5" role="status">
              <p>
                Your account was created, but we could not sign you in. Please
                sign in to continue.
              </p>
              <Link
                to="/login"
                className="mt-3 inline-block text-primary underline"
              >
                Go to sign in
              </Link>
            </div>
          ) : (
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void form.handleSubmit();
              }}
            >
              {mode === 'register' && (
                <form.Field name="name">
                  {(field) => (
                    <FormField id="name" label="Name" error={nameError}>
                      <Input
                        id="name"
                        aria-invalid={!!nameError}
                        aria-describedby={nameError ? 'name-error' : undefined}
                        autoComplete="name"
                        required
                        maxLength={100}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          setNameError('');
                          field.handleChange(e.target.value);
                        }}
                      />
                    </FormField>
                  )}
                </form.Field>
              )}
              <form.Field name="email">
                {(field) => (
                  <FormField id="email" label="Email" error={emailError}>
                    <Input
                      id="email"
                      aria-invalid={!!emailError}
                      aria-describedby={emailError ? 'email-error' : undefined}
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        setEmailError('');
                        field.handleChange(e.target.value);
                      }}
                    />
                  </FormField>
                )}
              </form.Field>
              <form.Field name="password">
                {(field) => (
                  <FormField
                    id="password"
                    label="Password"
                    error={passwordError}
                  >
                    <Input
                      id="password"
                      aria-invalid={!!passwordError}
                      aria-describedby={
                        [
                          mode === 'register' ? 'password-description' : '',
                          passwordError ? 'password-error' : '',
                        ]
                          .filter(Boolean)
                          .join(' ') || undefined
                      }
                      type="password"
                      autoComplete={
                        mode === 'login' ? 'current-password' : 'new-password'
                      }
                      required
                      maxLength={72}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </FormField>
                )}
              </form.Field>
              {mode === 'register' && (
                <form.Field name="role">
                  {(field) => (
                    <fieldset className="space-y-3">
                      <legend className="text-sm font-medium">
                        Account type
                      </legend>
                      <div className="auth-role-options">
                        <label className="auth-role-option">
                          <input
                            type="radio"
                            name="role"
                            value="buyer"
                            className="peer sr-only"
                            checked={field.state.value === 'buyer'}
                            onChange={() => field.handleChange('buyer')}
                          />
                          <span className="auth-role-card">
                            <ShoppingBasket aria-hidden="true" />
                            <span>
                              <strong>Buyer</strong>
                              <small>Find local favourites</small>
                            </span>
                            <span className="auth-role-dot" />
                          </span>
                        </label>
                        <label className="auth-role-option">
                          <input
                            type="radio"
                            name="role"
                            value="producer"
                            className="peer sr-only"
                            checked={field.state.value === 'producer'}
                            onChange={() => field.handleChange('producer')}
                          />
                          <span className="auth-role-card">
                            <Sprout aria-hidden="true" />
                            <span>
                              <strong>Producer</strong>
                              <small>Share what you grow</small>
                            </span>
                            <span className="auth-role-dot" />
                          </span>
                        </label>
                      </div>
                    </fieldset>
                  )}
                </form.Field>
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(submitting) => (
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="auth-submit"
                  >
                    {submitting
                      ? 'Please wait…'
                      : mode === 'login'
                        ? 'Sign in'
                        : 'Sign up'}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                )}
              </form.Subscribe>
            </form>
          )}
          <p className="auth-switch">
            {mode === 'login' ? (
              <>
                New here?{' '}
                <Link to="/register" className="text-primary underline">
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already registered?{' '}
                <Link to="/login" className="text-primary underline">
                  Sign in
                </Link>
              </>
            )}
          </p>
          <p className="auth-form-footer">
            <Sprout aria-hidden="true" /> Rooted in community.
          </p>
        </div>
      </section>
    </main>
  );
}
export function Account() {
  const query = useQuery({
    queryKey: sessionKey,
    queryFn: currentUser,
    retry: false,
    staleTime: 0,
  });
  const client = useQueryClient();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    setMessage('');
    try {
      const signingOut = logout();
      await client.cancelQueries();
      client.setQueryData(sessionKey, null);
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== sessionKey[0],
      });
      await signingOut;
      await navigate({ to: '/' });
    } catch {
      client.setQueryData(sessionKey, null);
      setMessage(
        'Signed out locally, but the server could not revoke your session. Retry revocation.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (query.isPending) return null;
  if (!query.data)
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        {message && (
          <p role="alert" className="mb-5 text-destructive">
            {message}
          </p>
        )}
        <h1 className="text-2xl font-semibold">
          {query.error instanceof ApiError && query.error.status !== 401
            ? 'Could not restore your session'
            : 'Please sign in'}
        </h1>
        <div className="mt-5 flex gap-4">
          {message ? (
            <Button disabled={busy} onClick={() => void signOut()}>
              {busy ? 'Retrying...' : 'Retry revocation'}
            </Button>
          ) : (
            query.error && (
              <Button onClick={() => void query.refetch()}>Try again</Button>
            )
          )}
          <Link to="/login" className="underline">
            Sign in
          </Link>
        </div>
      </main>
    );
  const current: User = query.data;
  const pathname = window.location.pathname;
  const requestedSellingPath =
    pathname.startsWith('/producer/') && pathname !== '/producer/'
      ? pathname
      : undefined;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <div className="rounded-2xl border bg-card p-4 sm:p-5 md:p-8">
        <header className="flex flex-wrap items-center gap-4 border-b pb-6">
          <AvatarPicker user={current} />
          <div className="min-w-0 flex-1">
            {current.role === 'producer' ? (
              <ProducerStatusBadge
                status={current.producerStatus ?? 'pending'}
                className="mb-1"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Your account</p>
            )}
            <h1 className="text-2xl leading-tight break-words md:text-3xl">
              {current.name}
            </h1>
            <p
              className="truncate text-sm text-muted-foreground"
              title={current.email}
            >
              {current.email}
            </p>
          </div>
          <div className="-ml-2.5 flex basis-full items-center gap-1 sm:ml-0 sm:basis-auto">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void signOut()}
            >
              <LogOut aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </header>
        {message && (
          <p role="alert" className="mt-4 text-destructive">
            {message}
          </p>
        )}
        {query.isError && (
          <div role="alert" className="mt-5 rounded-lg border p-4 text-sm">
            <p>
              Could not refresh your account. The information shown may be out
              of date.
            </p>
            <Button
              className="mt-3"
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Retry
            </Button>
          </div>
        )}
        {current.role === 'producer' && (
          <>
            <ProducerOnboarding
              key={current.id}
              user={current}
              requestedSellingPath={requestedSellingPath}
            />
            {current.producerStatus === 'approved' && (
              <div className="mt-8">
                <ProducerProfileEditor />
              </div>
            )}
          </>
        )}
        {current.role === 'buyer' && (
          <PaymentMethods key={current.id} buyerId={current.id} />
        )}
      </div>
    </main>
  );
}
