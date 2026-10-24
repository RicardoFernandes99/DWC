# API boundaries

Use class-validator DTOs and the existing global ValidationPipe. Validate path IDs
and query bounds as well as bodies; construct query filters explicitly to exclude
caller-supplied Mongo operators. Declare responses and refusals in Swagger.

When auth exists, guards verify JWT identity and services also enforce ownership
and transitions. A valid buyer token cannot edit a producer's product. Socket room
joins and messages need the same checks. Do not create a demo-only auth shortcut.

Use explicit response fields: input validation cannot remove hashes from output.
Keep expected conflict/validation errors useful and internal failures private.
Never log credentials, tokens, signed URLs or full sensitive request bodies.

Keep validated configuration, Nest logging, request/operation context and graceful
shutdown. Health/readiness responses expose no secrets. Add rate/body limits where
the feature needs them without importing a deployment or observability platform.
