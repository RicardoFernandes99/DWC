# Socket.IO event contract

Socket.IO is a live-delivery supplement to the HTTP API. The server listens on
the existing API HTTP server at the default Socket.IO path (`/socket.io/`) and
the default namespace (`/`). Its Engine.IO CORS options use configured
`WEB_ORIGIN`. Browser
clients must connect from that origin; a supplied mismatching `Origin` is
rejected for every transport. Non-browser clients may omit `Origin`.

## Default namespace handshake

Send the current access JWT in Socket.IO's `auth` object:

```ts
io(apiOrigin, { auth: { accessToken } });
```

`accessToken` is a raw JWT (not a `Bearer` header) with a maximum length of
2,000 characters. The API validates its signature, issuer, audience, expiry,
Redis session and current MongoDB user through the same `AuthService` used by
HTTP. A successful connection joins only the server-derived `user:<userId>`
room. Client-supplied room names and user IDs are never accepted as authority.
No client-to-server application events are defined on the default namespace.

The default namespace checks identity at connection time. Personal events are
sent to those authenticated connections without repeating session validation
before every emission.

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

## Public auction namespace

Connect to `/auctions` without a handshake token to watch as a guest. The
configured `WEB_ORIGIN` is enforced when an `Origin` header is present. A watcher
joins with `auction.join` and `{ auctionId }`; the server validates the ID and
derives the room. `auction.leave` leaves that derived room. There is no arbitrary
room join event. Joining emits `auction.state` and returns the same current
state in its acknowledgement. Reconnect by joining again, then fetch paginated
history from `GET /api/auctions/{id}/bids`.

The public HTTP API also exposes `GET /api/auctions/{id}/live` for an
authoritative state and `serverTime` snapshot when Socket.IO is disconnected.
Its viewer count is zero because an HTTP request is not a watching socket.
Clients must keep the last socket viewer count while connected and show the
count as unavailable while disconnected. `GET
/api/auctions/{id}/result` requires a buyer session and reports only that
buyer's result: pending, won with their persisted order and payment status, or
not the winner. The result response is not cached.

The state includes the auction ID, public state, starting price, increment,
current bid and bidder display name, server time, deadline, revision and
`viewerCount`. Viewer count means connected watching sockets, including guests;
tabs count separately and the label is “viewers”. This count is local to one API
process.

Submit `auction.bid` with `{ requestId, auctionId, amountCents,
paymentMethodId, accessToken }`. The gateway verifies the current access token,
session and user for every bid, then the domain service checks buyer role,
method ownership/expiry and atomic auction conditions. The acknowledgement is
either `{ ok: true, duplicate, bid, state }` or a safe refusal with a code and
actionable message. Accepted state is broadcast only after the auction summary
and separate history record commit. Retried request IDs return the original
accepted bid and do not broadcast again; reusing one with different bid inputs
is refused. Bid attempts are throttled per buyer to ten per ten seconds in one
API process.

## Server to client

| Event                  | Payload                                                                                  | Recipient                                       |
| ---------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `notification.created` | `{ notificationId: string }`                                                             | The notification owner's authenticated sockets. |
| `auction.state`        | Current public auction state                                                             | Watching sockets in the derived auction room.   |
| `auction.bid.accepted` | `{ bid, state }` with public fields                                                      | Watching sockets after a committed bid.         |
| `auction.closed`       | `{ auctionId, state: "finished", winningAmountCents, winnerName, revision, serverTime }` | Watching sockets after settlement commits.      |

The notification payload contains only the persisted notification ID; clients
fetch its content through the authenticated inbox API. Revocation or expiry
after the default namespace handshake does not proactively disconnect a socket;
clients disconnect on logout and reconnect with refreshed credentials. Offline clients recover through
persisted inbox fetches. Bid events separately
revalidate identity for each action.

Auction watcher tracking is removed on disconnect. Sockets are disconnected
during API shutdown. There is no cross-process adapter;
this contract covers the single API process in local development.

Auction broadcasts are best-effort after commit. A crash between persistence and
emission can omit an event; reconnecting clients fetch authoritative state and
history. Concurrent responses can arrive out of revision order, so clients must
ignore older auction revisions, including original-state acknowledgements for
retried bids. Viewer counts may change without changing the auction revision.
`auction.closed` contains only the public winner name and lot amount; it never
includes buyer, order, or payment identifiers. A missed completion event is
recovered by reading the finished auction and order through HTTP.
