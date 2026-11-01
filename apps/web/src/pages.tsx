import { safeReturn } from './safe-return';
import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, useNavigate, useSearch } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import {
  ApiError,
  login,
  logout,
  currentUser,
  register,
  type User,
} from '@/lib/session';

const sessionKey = ['session'] as const;
export function Shell() {
  const query = useQuery({
    queryKey: sessionKey,
    queryFn: currentUser,
    retry: false,
    staleTime: 0,
  });
  return (
    <>
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <Link to="/" className="font-semibold">
            From Farm to Table
          </Link>
          <div className="flex gap-4 text-sm">
            <Link to="/">Home</Link>
            {query.data ? (
              <Link
                to={query.data.role === 'producer' ? '/producer' : '/account'}
              >
                My account
              </Link>
            ) : (
              <>
                <Link to="/login">Sign in</Link>
                <Link to="/register">Register</Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <Outlet />
    </>
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
        setPasswordError('Password must be between 8 and 72 UTF-8 bytes.');
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
            safeReturn(search.returnTo) ??
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
    <main className="mx-auto max-w-lg px-6 py-12 md:py-20 xl:py-24">
      <p className="text-sm font-medium uppercase tracking-widest text-primary">
        From Farm to Table
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        {mode === 'login' ? 'Welcome back' : 'Create your account'}
      </h1>
      <p className="mt-3 text-muted-foreground">
        {mode === 'login'
          ? 'Sign in to your account.'
          : 'Join as a buyer or a local producer.'}
      </p>
      {created ? (
        <div className="mt-8 rounded-lg border p-5" role="status">
          <p>
            Your account was created, but we could not sign you in. Please sign
            in to continue.
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
          className="mt-8 space-y-5"
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
                description={
                  mode === 'register' ? 'Use 8 to 72 UTF-8 bytes.' : undefined
                }
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
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Account type</legend>
                  <div className="flex gap-6">
                    <label>
                      <input
                        type="radio"
                        name="role"
                        value="buyer"
                        checked={field.state.value === 'buyer'}
                        onChange={() => field.handleChange('buyer')}
                      />{' '}
                      Buyer
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="role"
                        value="producer"
                        checked={field.state.value === 'producer'}
                        onChange={() => field.handleChange('producer')}
                      />{' '}
                      Producer
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
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? 'Please wait…'
                  : mode === 'login'
                    ? 'Sign in'
                    : 'Create account'}
              </Button>
            )}
          </form.Subscribe>
        </form>
      )}
      <p className="mt-6 text-sm">
        {mode === 'login' ? (
          <>
            New here?{' '}
            <Link to="/register" className="text-primary underline">
              Create an account
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
  if (query.isPending)
    return (
      <main className="mx-auto max-w-5xl px-6 py-16" role="status">
        Restoring your session…
      </main>
    );
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
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 md:py-20">
      <h1 className="text-3xl font-semibold">Hello, {current.name}</h1>
      <p className="mt-2 text-muted-foreground">{current.email}</p>
      {query.isError && (
        <div role="alert" className="mt-5 rounded-lg border p-4 text-sm">
          <p>
            Could not refresh your account. The information shown may be out of
            date.
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
        <section className="mt-8 rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Producer status</h2>
          <p className="mt-2">
            {current.producerStatus === 'pending'
              ? 'Pending approval'
              : current.producerStatus === 'approved'
                ? 'Approved'
                : current.producerStatus === 'rejected'
                  ? 'Application rejected'
                  : current.producerStatus === 'suspended'
                    ? 'Your producer account is suspended.'
                    : 'Status unavailable'}
          </p>
        </section>
      )}
      {message && (
        <p role="alert" className="mt-5 text-destructive">
          {message}
        </p>
      )}
      <Button
        className="mt-8"
        variant="outline"
        disabled={busy}
        onClick={() => void signOut()}
      >
        Sign out
      </Button>
    </main>
  );
}
