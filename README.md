# Fastify Service Template

Layered Fastify/TypeScript service template with Zod validation, Postgres, Swagger, Docker, AWS ECS infrastructure, and GitHub Actions for CI and deploys.

## What you get

- **Layered code:** `routes -> handlers -> services -> repositories`, with a complete example `items` feature.
- **Zod schemas:** request validation, handler types, and Swagger docs all come from one schema per request.
- **Validated config:** bad environment variables fail at startup, not at runtime.
- **Consistent API:** `{ success, data }` and `{ success, error }` response envelopes, typed errors, and request IDs.
- **Postgres** through `@fastify/postgres`, with plain SQL schema files.
- **Swagger UI** at `/docs`.
- **Tests** with Jest that don't need a database.
- **Dockerfile** with a multi-stage build that runs as a non-root user.
- **Terraform** for a disposable AWS environment: VPC, ALB, ECR, ECS Fargate, and a GitHub OIDC deploy role.
- **GitHub Actions** for CI, and deploys to ECS when you publish a GitHub release.

<!-- template-only:start -->

## Using this template

1. Create a repo from this template. Use GitHub's **Use this template** button, or the `new-project` agent skill, which also renames everything.
2. If you copied it by hand, replace these names:

   | Find                       | Replace with                           | Where                                                      |
   | -------------------------- | -------------------------------------- | ---------------------------------------------------------- |
   | `fastify-service-template` | your service name (kebab-case)         | `package.json`, `package-lock.json`, tfvars                |
   | `Fastify Service Template` | your service title                     | `README.md`, `src/app.ts`                                  |
   | `fastify_service_template` | your Postgres schema name (snake_case) | `db/schema/`, `src/data/`, `src/config.ts`, `.env.example` |
   | `fastify-svc`              | a short AWS name prefix                | `infrastructure/`                                          |
   | `@kmasouri`                | your GitHub user or team               | `.github/CODEOWNERS`                                       |

3. Build your domain by following `docs/adding-a-feature.md`. Delete the `items` example when you no longer need it.

<!-- template-only:end -->

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

The `.env` file is loaded only when `ENVIRONMENT=local`. Point it at any Postgres instance, then create the tables:

```bash
psql "$DATABASE_URL" -f db/schema/000_schema.sql
psql "$DATABASE_URL" -f db/schema/001_items.sql
```

The service listens on `http://localhost:3000` by default. Swagger UI is at `http://localhost:3000/docs`.

## Environment variables

All variables are validated at startup in `src/config.ts`.

| Name                | Default                    | Description                                                         |
| ------------------- | -------------------------- | ------------------------------------------------------------------- |
| `ENVIRONMENT`       | `production`               | App environment name. Use `local` to load `.env`; tests use `test`. |
| `HOST`              | `0.0.0.0`                  | Host passed to Fastify when the server starts.                      |
| `PORT`              | `3000`                     | Port passed to Fastify when the server starts.                      |
| `DATABASE_URL`      |                            | Optional PostgreSQL connection string. Overrides `DATABASE_*`.      |
| `DATABASE_HOST`     | `localhost`                | PostgreSQL host when `DATABASE_URL` is not set.                     |
| `DATABASE_PORT`     | `5432`                     | PostgreSQL port when `DATABASE_URL` is not set.                     |
| `DATABASE_NAME`     | `fastify_service_template` | PostgreSQL database name when `DATABASE_URL` is not set.            |
| `DATABASE_USER`     | `fastify_service_template` | PostgreSQL username when `DATABASE_URL` is not set.                 |
| `DATABASE_PASSWORD` | `fastify_service_template` | PostgreSQL password when `DATABASE_URL` is not set.                 |
| `LOGGER_LEVEL`      | `info`                     | Fastify logger level. Tests set this to `silent`.                   |
| `REQUEST_ID_HEADER` | `x-request-id`             | Header Fastify reads for request IDs and reflects in responses.     |

## Commands

```bash
npm run dev            # watch mode with .env
npm test
npm run test:coverage
npm run build          # compiles to dist/
npm run lint
npm run format
npm run check          # lint + typecheck + build + test (what CI runs)
```

## Docker

```bash
docker build -t fastify-service-template .
docker run --rm -p 3000:3000 -e DATABASE_URL=postgres://... fastify-service-template
```

## API

- `GET /health`
- `GET /docs`
- `POST /items`
- `GET /items?limit=50&offset=0`
- `GET /items/:itemId`

## Architecture

- `docs/architecture.md`: the layers, Zod setup, plugins, logging, errors, and tests.
- `docs/adding-a-feature.md`: a step-by-step checklist for new endpoints.
- `AGENTS.md`: the same rules, written for AI coding agents.

## Infrastructure

The `infrastructure/` folder contains Terraform for a disposable AWS test environment: a three-tier VPC, an ALB, an ECR repository, and an ECS Fargate service. See [infrastructure/README.md](infrastructure/README.md).

## Releases and deployment

To release and deploy a new version:

1. In GitHub, go to **Releases** and click **Draft a new release**.
2. Create a new tag such as `v1.2.0`. Click **Generate release notes** if you want GitHub to list the merged pull requests.
3. Click **Publish release**.

Publishing starts the `release` workflow. It builds the Docker image, tags it with the version (`1.2.0`) and `latest`, and deploys it to the `sandbox` ECS service.

Required GitHub environment configuration for `sandbox`:

| Name                 | Kind     | Description                                                 |
| -------------------- | -------- | ----------------------------------------------------------- |
| `AWS_ROLE_TO_ASSUME` | secret   | IAM role ARN that GitHub Actions assumes through OIDC.      |
| `AWS_REGION`         | variable | AWS region containing the ECR and ECS resources.            |
| `ECR_REPOSITORY`     | variable | ECR repository name, such as `fastify-svc-sandbox-service`. |
| `ECS_CLUSTER`        | variable | ECS cluster name, such as `fastify-svc-sandbox-cluster`.    |
| `ECS_SERVICE`        | variable | ECS service name, such as `fastify-svc-sandbox-service`.    |

The manual `deploy` workflow redeploys an image tag that is already pushed, without creating a new release.
