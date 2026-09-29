# Architecture

This service uses a layered Fastify structure:

```text
routes -> handlers -> services -> repositories -> Postgres
```

Fastify owns dependency wiring through plugins and decorators. The code inside each request follows conventional layers so business rules stay testable without HTTP or a database.

## Layers

- `routes/`: Fastify route plugins. Routes own HTTP method/path registration and the Zod schemas for params, querystring, and body.
- `handlers/`: HTTP orchestration. Handlers read request data, call services, log domain events, choose response status codes, and wrap success responses.
- `services/`: Application behavior and domain rules. Services do not know about Fastify request/reply objects.
- `data/`: Repository contracts and Postgres implementations. Repositories own SQL and row mapping.
- `observability/`: Domain event loggers today, with room for metrics and tracing later.
- `plugins/`: Fastify plugins that build repositories, services, and loggers and attach them to the Fastify instance.
- `shared/`: Cross-cutting domain types, response envelopes, and structured errors.

The example feature is `items`. It exists to show every layer end to end; replace or delete it when you build your own domain.

## Schemas and types with Zod

Zod replaces Fastify's default Ajv validator. `src/app.ts` sets this up once:

```ts
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
```

It also passes `jsonSchemaTransform` to `@fastify/swagger`, which converts the Zod schemas into JSON Schema for the OpenAPI document at `GET /docs`.

Each feature keeps its schemas in `routes/<feature>/<feature>.schemas.ts`, next to the inferred types:

```ts
export const createItemBodySchema = z.strictObject({
  name: z.string().trim().min(1)
});
export type CreateItemBody = z.infer<typeof createItemBodySchema>;
```

The route passes the schema to Fastify, and the handler uses the type:

```ts
// routes/items/items.ts
schema: {
  body: createItemBodySchema;
}

// handlers/items/items.ts
request: FastifyRequest<{ Body: CreateItemBody }>;
```

Because both come from one definition, the validation rules and the handler's types cannot drift apart.

Zod's parsed output is what reaches the handler. Defaults (`.default(50)`), coercion (`z.coerce.number()`), and transforms (`.trim()`) are already applied by the time `request.query` or `request.body` is read.

Query strings and path params always arrive as strings. Use `z.coerce.number()` for numeric values there.

Routes do not declare response schemas today. You can add them under `schema.response`. The Zod serializer then validates outgoing data, and a mismatch becomes a 500 error.

## Fastify plugins

Repositories and services are registered through feature-level Fastify plugins:

- `itemPlugin` decorates `fastify.itemLogger`, `fastify.itemRepository`, and `fastify.itemService`.

Each plugin adds its decorators to the `FastifyInstance` type with `declare module 'fastify'`. It also lists the plugins it depends on in `fp(..., { dependencies })`, so Fastify fails at startup if registration order is wrong.

Handlers are not Fastify plugins. They are plain functions that use `request.server` to access decorated services:

```ts
await request.server.itemService.getItem(itemId);
```

## Logging

Loggers are thin domain event emitters registered on the Fastify instance. Handlers call them with `request.log` after a service operation succeeds:

```ts
request.server.itemLogger.onItemCreated(request.log);
```

Using `request.log` keeps the request ID on every log line without passing Fastify request context into services or repositories.

Domain logs always include one structured field:

```json
{ "event": "item.created" }
```

Event names are lowercase, dot-delimited, and domain first. Logger method names use the lifecycle style `onThingHappened()`.

## Responses and errors

Successful responses use:

```json
{ "success": true, "data": {} }
```

Error responses use:

```json
{
  "success": false,
  "error": { "code": 1400, "name": "validation_error", "message": "Request validation failed" }
}
```

| Class             | HTTP | Code | Name               |
| ----------------- | ---- | ---- | ------------------ |
| `ValidationError` | 400  | 1400 | `validation_error` |
| `NotFoundError`   | 404  | 1404 | `not_found`        |
| `ConflictError`   | 409  | 1409 | `conflict`         |
| anything else     | 500  | 1000 | `internal_error`   |

Services throw these classes. The error handler in `src/app.ts` formats them, and it formats Zod request validation failures as `validation_error`. Handlers should not catch errors just to format responses.

Every response echoes the request ID in the `REQUEST_ID_HEADER` header, which defaults to `x-request-id`. An incoming value is reused; otherwise a UUID is generated.

## Configuration

`src/config.ts` declares every environment variable in one Zod schema. It exports a single `config` object. Invalid values fail at startup with a message that names the variable.

Only `ENVIRONMENT=local` loads `.env`, through Node's native `process.loadEnvFile()`. All other environments use runtime environment variables only.

## Database

The app uses Postgres via `@fastify/postgres`. The pool connects lazily, so the app and its tests start without a database.

Table definitions live in `db/schema/`, numbered in dependency order. `000_schema.sql` creates the service's Postgres schema, and the remaining files create tables inside it. Apply them in filename order; they are idempotent (`IF NOT EXISTS`).

## Tests

Tests live next to the files they exercise as `*.test.ts`. Shared fakes use `*.test-helper.ts` and are excluded from the production build.

- Service tests use in-memory repositories, such as `InMemoryItemRepository`.
- Route tests call `setupApp()` and `app.inject()`. They cover validation, error formatting, request IDs, and Swagger without a database.

## Build and deploy

`tsc -p tsconfig.build.json` compiles `src/` into `dist/`, skipping tests. `npm start` and the Dockerfile run `dist/index.js`.

The `infrastructure/` folder holds Terraform for a disposable AWS environment: VPC, ALB, ECR, and ECS Fargate. GitHub Actions workflows in `.github/workflows/` run checks, cut semantic releases, and deploy to ECS. See `README.md` and `infrastructure/README.md`.
