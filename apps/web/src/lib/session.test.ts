import { beforeEach, describe, expect, it, vi } from 'vitest';
const person = {
  id: '1',
  name: 'One',
  email: 'one@example.com',
  role: 'buyer',
  producerStatus: null,
};
const session = (accessToken: string) => ({
  accessToken,
  expiresIn: 900,
  user: person,
});
const response = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});
describe('browser session', () => {
  it('shares one refresh for concurrent expired requests and retries once', async () => {
    let refreshes = 0;
    const fetch = vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith('/login')) return response(200, session('old'));
      if (url.endsWith('/refresh')) {
        refreshes++;
        return response(200, session('new'));
      }
      const headers = options.headers as Record<string, string>;
      return headers.Authorization === 'Bearer old'
        ? response(401)
        : response(200, person);
    });
    vi.stubGlobal('fetch', fetch);
    const client = await import('./session');
    await client.login({ email: person.email, password: 'password' });
    await Promise.all([client.me(), client.me()]);
    expect(refreshes).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(6);
  });
  it('stops after an unauthorized refresh', async () => {
    const fetch = vi.fn(async (url: string) =>
      url.endsWith('/login') ? response(200, session('old')) : response(401),
    );
    vi.stubGlobal('fetch', fetch);
    const client = await import('./session');
    await client.login({ email: person.email, password: 'password' });
    await expect(client.me()).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('does not install a refresh after logout starts', async () => {
    let resolveRefresh: (value: ReturnType<typeof response>) => void = () => {};
    const waiting = new Promise<ReturnType<typeof response>>((resolve) => {
      resolveRefresh = resolve;
    });
    const fetch = vi.fn(async (url: string) =>
      url.endsWith('/refresh') ? waiting : response(204),
    );
    vi.stubGlobal('fetch', fetch);
    const client = await import('./session');
    const refreshing = client.refresh();
    const signingOut = client.logout();
    resolveRefresh(response(200, session('stale')));
    await expect(refreshing).rejects.toMatchObject({ status: 401 });
    await signingOut;
    await expect(client.me()).rejects.toMatchObject({ status: 401 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('does not clear a new login when an older restore finishes', async () => {
    let resolveRefresh: (value: ReturnType<typeof response>) => void = () => {};
    const waiting = new Promise<ReturnType<typeof response>>((resolve) => {
      resolveRefresh = resolve;
    });
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/refresh')) return waiting;
      if (url.endsWith('/login')) return response(200, session('new'));
      return response(200, person);
    });
    vi.stubGlobal('fetch', fetch);
    const client = await import('./session');
    const oldRestore = client.currentUser();
    await client.login({ email: person.email, password: 'password' });
    resolveRefresh(response(200, session('old')));
    await expect(oldRestore).rejects.toMatchObject({ status: 401 });
    await expect(client.currentUser()).resolves.toEqual(person);
  });
  it('uses the shared bearer session for API feature requests and retries once', async () => {
    let apiAttempts = 0;
    const fetch = vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith('/login')) return response(200, session('old'));
      if (url.endsWith('/refresh')) return response(200, session('new'));
      apiAttempts++;
      const headers = options.headers as Record<string, string>;
      return headers.Authorization === 'Bearer old'
        ? response(401)
        : response(200, []);
    });
    vi.stubGlobal('fetch', fetch);
    const client = await import('./session');
    await client.login({ email: person.email, password: 'password' });
    await expect(
      client.authenticatedRequest('payment-methods'),
    ).resolves.toEqual([]);
    expect(fetch.mock.calls.map(([url]) => url)).toContain(
      '/api/payment-methods',
    );
    expect(apiAttempts).toBe(2);
  });
  it('rejects a successful feature response after logout changes the session', async () => {
    let resolveRequest: (value: ReturnType<typeof response>) => void = () => {};
    const waiting = new Promise<ReturnType<typeof response>>((resolve) => {
      resolveRequest = resolve;
    });
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith('/login')) return response(200, session('active'));
      if (url.endsWith('/payment-methods')) return waiting;
      return response(204);
    });
    vi.stubGlobal('fetch', fetch);
    const client = await import('./session');
    await client.login({ email: person.email, password: 'password' });
    const staleRequest = client.authenticatedRequest('payment-methods');
    const signingOut = client.logout();
    resolveRequest(response(200, []));
    await expect(staleRequest).rejects.toMatchObject({ status: 401 });
    await signingOut;
  });
});
