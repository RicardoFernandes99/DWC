import type { components } from './api-schema';

type User = components['schemas']['UserResponseDto'];
type Auth = components['schemas']['AuthResponseDto'];
export type Login = components['schemas']['LoginDto'];
export type Registration = components['schemas']['RegisterUserDto'];
export type { User };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function user(value: unknown): value is User {
  return (
    record(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.email === 'string' &&
    (value.role === 'buyer' ||
      value.role === 'producer' ||
      value.role === 'admin') &&
    (value.producerStatus === null ||
      value.producerStatus === 'pending' ||
      value.producerStatus === 'approved' ||
      value.producerStatus === 'rejected' ||
      value.producerStatus === 'suspended') &&
    (value.producerRejectionReason === null ||
      typeof value.producerRejectionReason === 'string')
  );
}
function auth(value: unknown): value is Auth {
  return (
    record(value) &&
    typeof value.accessToken === 'string' &&
    value.expiresIn === 900 &&
    user(value.user)
  );
}
async function request<T = unknown>(
  path: string,
  options: RequestInit = {},
  base = '/api/auth',
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}/${path}`, {
      ...options,
      credentials: options.credentials ?? 'include',
      signal: options.signal ?? AbortSignal.timeout(10000),
      headers:
        options.body instanceof FormData
          ? options.headers
          : { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new ApiError(0, 'Could not connect. Please try again.');
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      response.status === 503
        ? 'Service temporarily unavailable. Please try again.'
        : 'The request could not be completed.',
    );
  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(0, 'The server returned an invalid response.');
  }
}
export function publicRequest<T = unknown>(path: string): Promise<T> {
  return request<T>(path, { credentials: 'omit' }, '/api');
}
let token: string | undefined;
let signedOut = false;
let generation = 0;
let pending: Promise<Auth> | undefined;
function install(value: unknown, current: number): Auth {
  if (!auth(value))
    throw new ApiError(0, 'The server returned an invalid response.');
  if (generation !== current) throw new ApiError(401, 'Session changed.');
  token = value.accessToken;
  return value;
}
export async function login(input: Login): Promise<User> {
  const current = ++generation;
  signedOut = false;
  token = undefined;
  pending = undefined;
  return install(
    await request('login', { method: 'POST', body: JSON.stringify(input) }),
    current,
  ).user;
}
export async function register(input: Registration): Promise<void> {
  const result = await request('register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!user(result))
    throw new ApiError(0, 'The server returned an invalid response.');
}
export function refresh(): Promise<Auth> {
  if (pending) return pending;
  const current = generation;
  const work = request('refresh', { method: 'POST' })
    .then((value) => install(value, current))
    .catch((error: unknown) => {
      if (
        generation === current &&
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      )
        token = undefined;
      throw error;
    })
    .finally(() => {
      if (pending === work) pending = undefined;
    });
  pending = work;
  return work;
}
export async function me(): Promise<User> {
  const current = generation;
  const used = token;
  if (!used) throw new ApiError(401, 'Please sign in.');
  let result: unknown;
  try {
    result = await request('me', {
      headers: { Authorization: `Bearer ${used}` },
    });
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      error.status !== 401 ||
      generation !== current
    )
      throw error;
    if (token === used) await refresh();
    if (generation !== current || !token)
      throw new ApiError(401, 'Please sign in.');
    try {
      result = await request('me', {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (retryError) {
      if (
        retryError instanceof ApiError &&
        retryError.status === 401 &&
        generation === current
      )
        token = undefined;
      throw retryError;
    }
  }
  if (generation !== current || !user(result))
    throw new ApiError(0, 'The server returned an invalid response.');
  return result;
}
/** Makes one authenticated API request, refreshing and retrying at most once. */
export async function authenticatedRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const current = generation;
  const used = token;
  if (!used) throw new ApiError(401, 'Please sign in.');
  const send = (accessToken: string) =>
    request<T>(
      path,
      {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
      },
      '/api',
    );
  const ensureCurrent = (result: T) => {
    if (generation !== current) throw new ApiError(401, 'Session changed.');
    return result;
  };
  try {
    return ensureCurrent(await send(used));
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      error.status !== 401 ||
      generation !== current
    )
      throw error;
    if (token === used) await refresh();
    if (generation !== current || !token)
      throw new ApiError(401, 'Please sign in.');
    const retryToken = token;
    try {
      return ensureCurrent(await send(retryToken));
    } catch (retryError) {
      if (
        retryError instanceof ApiError &&
        retryError.status === 401 &&
        generation === current &&
        token === retryToken
      )
        token = undefined;
      throw retryError;
    }
  }
}
export async function logout(): Promise<void> {
  const inFlight = pending;
  signedOut = true;
  ++generation;
  token = undefined;
  pending = undefined;
  if (inFlight) await inFlight.catch(() => undefined);
  await request('logout', { method: 'POST' });
}

export async function currentUser(): Promise<User | null> {
  if (signedOut) return null;
  const current = generation;
  try {
    return token ? await me() : (await refresh()).user;
  } catch (error) {
    if (
      generation === current &&
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    ) {
      token = undefined;
      signedOut = true;
      return null;
    }
    throw error;
  }
}
