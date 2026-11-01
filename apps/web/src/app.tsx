import { useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function App() {
  const [status, setStatus] = useState('Not checked yet');
  const [checking, setChecking] = useState(false);

  async function checkConnection() {
    setChecking(true);
    setStatus('Checking…');
    try {
      const response = await fetch('/api/health/ready', {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Service unavailable');
      const data: { status?: string } = await response.json();
      if (data.status !== 'ok') throw new Error('Dependencies unavailable');
      setStatus('API, database, and storage are available.');
    } catch {
      setStatus('Could not connect to the services. Please try again.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <main className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">
          Grown locally
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
          Closer to the people who grow it.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Local produce, orders, and live auctions. We are getting the
          marketplace ready.
        </p>
        <section
          aria-labelledby="connection-title"
          className="mt-12 rounded-xl border border-border bg-card p-6 md:max-w-xl"
        >
          <h2 id="connection-title" className="text-lg font-semibold">
            Service connection
          </h2>
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            {status}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={checkConnection} disabled={checking}>
              <RefreshCw aria-hidden="true" />
              {checking ? 'Checking…' : 'Check connection'}
            </Button>
            <Button asChild variant="outline">
              <a href="/api-docs">
                API documentation <ArrowUpRight aria-hidden="true" />
              </a>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
