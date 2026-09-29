# AGENTS.md

Instructions for AI coding agents working in this repository. Humans should start with `README.md`; the rules here apply to everyone.

## Commands

```bash
npm install
npm run dev            # ENVIRONMENT=local, loads .env, watches src/
npm run lint
npm run build          # tsc -p tsconfig.build.json -> dist/
npm test               # jest, ENVIRONMENT=test, silent logger
npm run check          # lint + typecheck + build + test; run this before you finish any change
```

Tests do not need a database. Never mark work done while `npm run check` fails.

## Architecture

Requests flow through fixed layers. Each layer only calls the one below it:

```text
routes -> handlers -> services -> repositories (src/data) -> Postgres
```

| Layer   | Folder                       | Owns                                                                                               | Must not                                                     |
| ------- | ---------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Route   | `src/routes/<feature>/`      | Method, path, Zod schemas, Swagger `description`/`tags`                                            | Contain logic                                                |
| Handler | `src/handlers/<feature>/`    | Read request, call a service, pick status, wrap response                                           | Contain business rules, catch errors to format them, run SQL |
| Service | `src/services/<feature>/`    | Business rules; throws `AppError` subclasses                                                       | Import Fastify request/reply types                           |
| Data    | `src/data/<feature>/`        | Access to every store (SQL, cache, etc.): repository interface + implementations, queries, mapping | Contain business rules                                       |
| Plugin  | `src/plugins/<domain>.ts`    | Build repo/logger/service and `decorate` the service onto Fastify                                  | Register routes                                              |
| Logger  | `src/observability/loggers/` | Domain event methods (`onItemCreated`), called by services                                         | Be called from handlers or repositories                      |
| Shared  | `src/shared/`                | Domain types, response envelope, error classes                                                     | Depend on any other layer                                    |

Full explanation: `docs/architecture.md`. Step-by-step feature walkthrough: `docs/adding-a-feature.md`.

## Rules

- **Zod is the only schema language.** Route schemas are Zod schemas in `src/routes/<feature>/<feature>.schemas.ts`. Export the schema and its `z.infer` type side by side. Handlers type requests with those inferred types (`FastifyRequest<{ Body: CreateItemBody }>`). Never hand-write a request type that duplicates a schema, and never write raw JSON Schema.
- **Query and path numbers need `z.coerce`.** Zod does not coerce strings like Ajv does.
- **Request bodies use `z.strictObject`** so unknown fields are rejected.
- **Handlers reach dependencies through `request.server`** (`request.server.itemService`), never through imports of concrete classes.
- **Errors:** services throw `NotFoundError`, `ConflictError`, or `ValidationError` from `src/shared/errors.ts`. The error handler in `src/app.ts` turns them into the error envelope. Do not `try/catch` in handlers just to format responses.
- **Responses:** always `success(data)` from `src/shared/response.ts`. Use `reply.code(201).send(success(x))` for creates.
- **Logging:** services log through their domain logger, passed in the constructor. Add a method to it for every new event. Event names are lowercase, dot-delimited, domain first (`item.created`). Method names are `onThingHappened`.
- **Config:** every environment variable is declared in the Zod schema in `src/config.ts`, documented in `README.md`, and added to `.env.example`. Read config only through the exported `config` object.
- **SQL:** parameterized queries only (`$1`, `$2`). Tables live in the Postgres schema named in `db/schema/000_schema.sql`. New tables go in a new numbered file in `db/schema/`.
- **Barrels:** each feature folder has an `index.ts`, and the layer root `index.ts` re-exports it. Import from the layer root (`from '../../data'`).
- **Tests** sit next to the file they test as `*.test.ts`. Shared fakes are `*.test-helper.ts`. Service tests mock the repository with `jest.fn()`. Route tests use `app.inject`.

## Naming

```text
src/routes/<feature>/<feature>.ts              -> <feature>Router
src/routes/<feature>/<feature>.schemas.ts      -> <thing>Schema + inferred type
src/handlers/<feature>/<feature>.ts            -> <action><Thing>Handler
src/services/<feature>/<domain>.service.ts     -> <Domain>Service
src/data/<feature>/<domain>.repository.ts      -> <Domain>Repository (interface)
src/data/<feature>/<domain>-postgres.repository.ts -> <Domain>PostgresRepository
src/observability/loggers/<feature>/<domain>.logger.ts -> <Domain>Logger
src/plugins/<domain>.ts                        -> default export fp(<domain>Plugin, { name: '<domain>' })
```

Feature folders are plural (`items`); domain file names are singular (`item.service.ts`).

## Do not

- Add a validation library other than Zod, or register Ajv schemas.
- Put business rules in routes or handlers.
- Add dependencies without a clear need; prefer what is already installed.
- Edit `infrastructure/` or `.github/workflows/` unless the task is about deployment.
- Upgrade TypeScript to 7.x until `ts-jest` and `typescript-eslint` support it. Both currently stop below 7.
- Remove `NODE_OPTIONS=--experimental-vm-modules` from the test scripts. Jest needs it to load ESM-only packages that `@fastify/swagger-ui` 6 depends on.
