# Architecture

A request passes through these layers, in this order:

```text
routes -> handlers -> services -> repositories -> data stores
```

Each layer has one job. Because of this split, you can test the business logic without starting a server or a database.

## Layers

- `routes/`: The URL and HTTP method for each endpoint, plus the Zod schemas that check the input.
- `handlers/`: Read the request, call a service, and send the response.
- `services/`: The business logic. This is where the app makes decisions. For example, creating an item with a name that is already taken throws a `ConflictError`, and asking for an item that does not exist throws a `NotFoundError`. Services get plain values, never the HTTP request or reply.
- `data/`: Reading and writing data. This covers every place data is kept: SQL databases, Redis and other caches, Databricks, file storage. Each one sits behind a repository. A repository has two parts: an interface that lists the methods services can call, and a class that does the real work, such as running SQL. Services only know about the interface, so tests can swap in a mock. Repositories do not make business decisions.
- `observability/`: Loggers for now. Metrics and tracing can go here later.
- `plugins/`: Create the repositories, services, and loggers when the app starts, and attach the services to the Fastify app.
- `shared/`: Code every layer can use: data types, the response format, and error classes.

The `items` feature is an example that uses every layer. Replace it or delete it when you build your own features. To add a feature, follow `docs/adding-a-feature.md`.

A feature only needs the layers it uses. `healthcheck` has a route and a handler, but no service or repository, because it has no logic and stores no data.

## Checking input with Zod

Zod checks all request input. It replaces Ajv, the checker Fastify uses by default. `src/app.ts` sets this up once:

```ts
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
```

The same Zod schemas also produce the API docs. Swagger UI is at `GET /docs`, and the raw OpenAPI JSON is at `GET /docs/json`.

Each feature keeps its schemas in `routes/<feature>/<feature>.schemas.ts`. Each schema has a TypeScript type made from it, right below it:

```ts
export const createItemBodySchema = z.strictObject({
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export type CreateItemBody = z.infer<typeof createItemBodySchema>;
```

The route uses the schema. The handler uses the type:

```ts
// routes/items/items.ts
fastifyInstance.post(
  '/items',
  {
    schema: {
      description: 'Create an item.',
      tags: ['items'],
      body: createItemBodySchema
    }
  },
  createItemHandler
);

// handlers/items/items.ts
export async function createItemHandler(
  request: FastifyRequest<{ Body: CreateItemBody }>,
  reply: FastifyReply
): Promise<FastifyReply> {
  const item = await request.server.itemService.createItem(request.body);
  return reply.code(201).send(success(item));
}
```

Both come from the same schema, so the checks and the types always match.

By the time the handler runs, Zod has already cleaned the input. Default values are filled in (`.default(50)`), strings are turned into numbers (`z.coerce.number()`), and text is trimmed (`.trim()`).

Query strings and URL params are always strings. Use `z.coerce.number()` when you need a number from them.

Routes do not check their responses yet. To add that, put a schema under `schema.response`. If a response does not match it, the client gets a 500 error.

## Plugins

Plugins create each feature's objects when the app starts and attach them to the Fastify app. For example, `itemPlugin` creates `ItemLogger` and `ItemPostgresRepository`, passes them to `ItemService`, and attaches `itemRepository` and `itemService`.

Each plugin also tells TypeScript about these new fields (with `declare module 'fastify'`). It lists the plugins it needs (with `fp(..., { dependencies })`), so the app fails at startup if they are loaded in the wrong order.

Handlers are plain functions, not plugins. They get services through `request.server`:

```ts
const item = await request.server.itemService.getItem(request.params.itemId);
```

## Logging

Each feature has a logger with one method per event. The service gets it in its constructor and calls it after something happens:

```ts
this.itemLogger.onItemCreated();
```

Every log line still gets the request ID. The `@fastify/request-context` plugin remembers which request is running, and `currentLogger()` in `src/observability/loggers/request-logger.ts` picks up that request's logger. Outside a request, such as at startup, it uses the app logger instead.

Every event log has an `event` field:

```json
{ "event": "item.created" }
```

Event names are lowercase, with dots between words, and start with the feature name. Logger methods are named `onThingHappened()`.

## Responses and errors

A successful response looks like this:

```json
{ "success": true, "data": {} }
```

An error response looks like this:

```json
{
  "success": false,
  "error": { "code": 1400, "name": "validation_error", "message": "Request validation failed" }
}
```

| Class                                                                 | HTTP                 | Code          | Name                                                               |
| --------------------------------------------------------------------- | -------------------- | ------------- | ------------------------------------------------------------------ |
| `ValidationError`                                                     | 400                  | 1400          | `validation_error`                                                 |
| `NotFoundError`                                                       | 404                  | 1404          | `not_found`                                                        |
| `ConflictError`                                                       | 409                  | 1409          | `conflict`                                                         |
| Fastify request errors (bad JSON, wrong content type, body too large) | Fastify's 4xx status | 1000 + status | from the status, such as `bad_request` or `unsupported_media_type` |
| unknown URL                                                           | 404                  | 1404          | `not_found`                                                        |
| anything else                                                         | 500                  | 1000          | `internal_error`                                                   |

Services throw these errors. Fastify catches any error thrown in a handler or service and passes it to the error handler in `src/app.ts`, which turns it into the error response above. Bad request input from Zod becomes a `validation_error`. For "anything else", the client only sees "Unexpected server error". The real error goes to the log, with the request ID. Handlers should not catch errors just to format them.

Every response includes the request ID in a header. The header name comes from `REQUEST_ID_HEADER` and is `x-request-id` by default. If the caller sends an ID, the app uses it. If not, the app makes a new one.

## Configuration

Every environment variable is listed in one Zod schema in `src/config.ts`. The rest of the code reads settings from the `config` object it exports. If a value is wrong, the app stops at startup and names the bad variable.

The `.env` file is loaded only when `ENVIRONMENT=local`. Everywhere else, settings come from real environment variables.

## Database

The app uses Postgres through `@fastify/postgres`. It only connects when the first query runs, so the app and its tests can start without a database.

If `DATABASE_URL` is set, the app uses it and ignores `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, and `DATABASE_PASSWORD`.

Table definitions are SQL files in `db/schema/`. `000_schema.sql` creates the Postgres schema, and the other files create the tables in it. Run them in filename order. Running them again is safe, because each one uses `IF NOT EXISTS`.

## Tests

Each test file sits next to the file it tests and ends in `.test.ts`. Shared test fakes end in `.test-helper.ts`. Neither is included in the production build.

- Service tests replace the repository with a Jest mock, so they need no database.
- Route tests build the app with `setupApp()` and send requests with `app.inject()`. They check input validation, error responses, request IDs, and Swagger, all without a database.

For building, releases, and deployment, see `README.md` and `infrastructure/README.md`.
