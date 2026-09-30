# AGENTS.md

Rules for AI coding agents working in this repo. They apply to people too.

This file says what to do and what not to do. For how things work and why, read:

- `docs/architecture.md`: how the code is set up.
- `docs/adding-a-feature.md`: step-by-step guide for a new feature.
- `docs/responses.md` and `docs/errors.md`: what the API sends back.

## Commands

```bash
npm install
npm run dev            # runs locally with .env and restarts on changes
npm run lint
npm run typecheck
npm run build          # compiles src/ to dist/
npm test               # no database needed
npm run check          # lint + typecheck + build + test
```

Run `npm run check` before you finish any change. Never call work done while it fails.

## Layers

A request goes `routes -> handlers -> services -> repositories`. Each layer only calls the one right below it. Routes and handlers both use `src/schemas/`, which imports nothing from the other layers.

Put new code in the folder for its layer, then in a folder for its feature. The full folder map, who can import what, and why, are in the "Where things live" and "Who can import what" sections of `docs/architecture.md`. Lint enforces the import rules; don't turn them off.

| Layer      | Folder                       | Does                                                                           | Never                                                   |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Route      | `src/routes/<feature>/`      | URL, method, which schema and handler to use, Swagger `description` and `tags` | Contain logic                                           |
| Schema     | `src/schemas/<feature>/`     | Zod schemas for request input, and their types                                 | Import from any layer but `shared`                      |
| Handler    | `src/handlers/<feature>/`    | Read the request, call one service, send the response                          | Make business decisions, use a repository, catch errors |
| Service    | `src/services/<feature>/`    | Business logic, logging, throwing errors                                       | Use Fastify request or reply objects                    |
| Repository | `src/data/<feature>/`        | Read and write data (SQL, cache, other stores)                                 | Make business decisions                                 |
| Plugin     | `src/plugins/<feature>.ts`   | Build the repository, logger, and service at startup                           | Attach anything but the service to Fastify              |
| Logger     | `src/observability/loggers/` | One method per event, called by services                                       | Be called from handlers or repositories                 |
| Shared     | `src/shared/`                | Types, response helpers, the error catalog                                     | Import from any other layer                             |

## Hard rules

- **Only services use repositories.** A plugin builds the repository and passes it to the service's constructor. Never attach a repository to Fastify, and never use one in a route or handler. Lint fails if a route or handler imports from `src/data`. If a service needs another feature's data, give it that feature's repository in its constructor.
- **Handlers get services from `request.server`**, like `request.server.itemService`. Never import a service class into a handler.
- **Zod is the only way to check input.** Schemas go in `src/schemas/<feature>/<feature>.schemas.ts`, with the `z.infer` type right below each one. Routes use the schemas, and handlers use the types. Never import from `src/routes` in a handler. Never write a request type by hand, and never write raw JSON Schema.
- **Request bodies use `z.strictObject`**, so unknown fields are rejected.
- **Numbers in the query string or URL use `z.coerce.number()`.** They arrive as strings.
- **Errors come from the catalog.** Every error has its own entry in `ERRORS` in `src/shared/errors.ts`, with a unique code: `10xxx` for general errors, and a new range per feature. Names are camelCase. Services throw `new AppError('itemNotFound', message)`. Add every new error to `docs/errors.md` too; a test checks this. Never change or reuse a code that has shipped.
- **Don't catch errors in handlers** just to build an error response. The error handler in `src/app.ts` does that.
- **Responses use the helpers** in `src/shared/response.ts`: `success(data)` for one thing, `paged(items, { limit, offset, total })` for lists. Creates return `201`. If you change the response shape, update `docs/responses.md`.
- **Services log through their feature's logger**, passed in the constructor. Add one method per event. Event names are lowercase with dots, feature first (`item.created`). Method names look like `onItemCreated`.
- **SQL uses parameters** (`$1`, `$2`), never values pasted into the query string. Tables live in the Postgres schema from `db/schema/000_schema.sql`. Each new table gets a new numbered file in `db/schema/`.
- **Every environment variable** goes in the Zod schema in `src/config.ts`, in the table in `README.md`, and in `.env.example`. Read settings only from the exported `config` object.
- **Import from the layer's root `index.ts`**, like `from '../../data'`, not from a feature folder inside it. Every feature folder has an `index.ts`, and the layer's root `index.ts` re-exports it.
- **Tests sit next to the file they test** and end in `.test.ts`. Service tests mock the repository with `jest.fn()`. Route tests use `app.inject`. Tests never need a database.
- **Write docs and comments in plain language.** Short sentences, everyday words.

## Naming

```text
src/routes/<feature>/<feature>.ts                       -> <feature>Router
src/schemas/<feature>/<feature>.schemas.ts              -> <thing>Schema + its type
src/handlers/<feature>/<feature>.ts                     -> <action><Thing>Handler
src/services/<feature>/<domain>.service.ts              -> <Domain>Service
src/data/<feature>/<domain>.repository.ts               -> <Domain>Repository (interface)
src/data/<feature>/<domain>-postgres.repository.ts      -> <Domain>PostgresRepository
src/observability/loggers/<feature>/<domain>.logger.ts  -> <Domain>Logger
src/plugins/<domain>.ts                                 -> default export fp(<domain>Plugin, { name: '<domain>' })
```

Feature folders are plural (`items`). File names inside them are singular (`item.service.ts`).

## Don't

- Add a validation library other than Zod, or use Ajv schemas.
- Add a package without a clear need. Use what's already installed first.
- Edit `infrastructure/` or `.github/workflows/` unless the task is about deployment.
- Upgrade TypeScript to 7 until `ts-jest` and `typescript-eslint` support it. Both stop below 7 today.
- Remove `NODE_OPTIONS=--experimental-vm-modules` from the test scripts. Jest needs it to load packages that `@fastify/swagger-ui` 6 depends on.
