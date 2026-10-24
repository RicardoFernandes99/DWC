# Mongoose persistence

Design from query patterns and consistency boundaries. Embed bounded owned values
such as order item snapshots; reference independently changing entities. Do not
put unbounded bid history in one document. Use projections, bounded pagination and
indexes matching filters/sort order. Translate unique-index failures deliberately.

Put stock, state-transition and bid conditions in the update filter. For stock,
match the product, allowed status and available quantity, then decrement atomically;
check the matched result. Bid acceptance must check the currently stored price,
increment, status and server deadline at its acceptance boundary, not only before
waiting for a write. Read-check-save alone loses races.

For multi-document invariants use a Mongoose transaction on the replica set.
Every participating operation uses the same session; perform operations
sequentially. Callbacks may retry, so keep them free of external side effects.
Broadcast only after commit. A transaction cannot roll back an S3 call or email.
Document failed-delivery behavior before adding an outbox/worker for a real need.

When stale edits matter, use a revision in the conditional update and increment it
consistently. Mongoose save versioning does not automatically make arbitrary
`findOneAndUpdate` calls version-safe. Test races with independent requests against
real MongoDB; mocked models cannot prove these guarantees.
