# Socket.IO event contract

Socket.IO is a live-delivery supplement to the HTTP API. The server listens on
the existing API HTTP server at the default Socket.IO path (`/socket.io/`) and
the default namespace (`/`). Its Engine.IO CORS options use configured
`WEB_ORIGIN`. Browser
clients must connect from that origin; a supplied mismatching `Origin` is
rejected for every transport. Non-browser clients may omit `Origin`.

## Handshake

Send the current access JWT in Socket.IO's `auth` object:

```ts
io(apiOrigin, { auth: { accessToken } });
```

`accessToken` is a raw JWT (not a `Bearer` header) with a maximum length of
2,000 characters. The API validates its signature, issuer, audience, expiry,
Redis session and current MongoDB user through the same `AuthService` used by
HTTP. A successful connection joins only the server-derived `user:<userId>`
room. Client-supplied room names and user IDs are never accepted as authority.
No client-to-server application events are currently defined.

Failed handshakes return a Socket.IO `connect_error` with a safe `data.code`:

| Code                  | Meaning                                                                            |
| --------------------- | ---------------------------------------------------------------------------------- |
| `unauthorized`        | Missing, malformed, expired or revoked access token, or no current user.           |
| `origin_not_allowed`  | Supplied `Origin` differs from configured `WEB_ORIGIN`.                            |
| `service_unavailable` | Session validation could not complete because an authentication dependency failed. |

Clients should refresh/re-authenticate after `unauthorized`, correct their
origin configuration after `origin_not_allowed`, and retry with backoff after
`service_unavailable`. Error messages do not include token or infrastructure
details.

## Server to client

| Event                  | Payload                      | Recipient                                            |
| ---------------------- | ---------------------------- | ---------------------------------------------------- |
| `notification.created` | `{ notificationId: string }` | The notification owner's authenticated sockets only. |

The payload contains only the persisted notification ID; clients fetch its
content through the authenticated inbox API. The API revalidates each socket's
JWT/session/current user immediately before each private emission. Revoked,
expired or unverifiable sessions are disconnected without receiving that
emission. Since Redis validation and socket delivery are separate operations, a
logout racing exactly with validation-to-emission may still overlap one event;
this transport does not claim atomic delivery with logout. Offline clients
recover through persisted inbox fetches once that feature is implemented.

Sockets are removed from the gateway's in-memory user registry on disconnect
and are disconnected during API shutdown. There is no cross-process adapter;
this contract covers the single API process in local development.
