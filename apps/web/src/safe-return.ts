import type { User } from './lib/session';
import { routeAccess } from './route-access';

export function safeReturn(value: unknown, user?: User): string | undefined {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    Array.from(value).some((character) => character.charCodeAt(0) < 32)
  )
    return undefined;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin &&
      (!user || routeAccess(url.pathname, user) === 'allow')
      ? `${url.pathname}${url.search}${url.hash}`
      : undefined;
  } catch {
    return undefined;
  }
}
