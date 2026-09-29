# Adding a Feature

This walkthrough adds a hypothetical `orders` feature. Copy the matching `items` file at each step and rename it. The `items` feature is the reference implementation.

Work from the bottom layer up, so each layer compiles against the one below it.

## 1. Table

Create `db/schema/002_orders.sql`, using the Postgres schema name from `000_schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS <schema>.orders (
  id uuid PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES <schema>.items(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

## 2. Domain type

Add the domain type to `src/shared/types.ts`. Use camelCase fields; the repository maps from snake_case rows.

```ts
export interface Order {
  id: string;
  itemId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## 3. Repository

Create these files under `src/data/orders/`:

- `order.repository.ts`: the `OrderRepository` interface plus its input types.
- `order-postgres.repository.ts`: `OrderPostgresRepository`, which holds the SQL, an `OrderRow` interface, and a private `toOrder(row)` mapper.
- `in-memory-order.repository.test-helper.ts`: `InMemoryOrderRepository`, for service tests.
- `index.ts`: re-exports the interface and the Postgres class (not the test helper).

Then add `export * from './orders';` to `src/data/index.ts`.

## 4. Service

Create `src/services/orders/order.service.ts` with an `OrderService` class. Its constructor takes repositories only; services never receive Fastify objects. It enforces business rules and throws `NotFoundError`, `ConflictError`, or `ValidationError`.

A service can depend on another domain's repository, for example to check that an item exists:

```ts
constructor(
  private readonly orderRepository: OrderRepository,
  private readonly itemRepository: ItemRepository
) {}
```

Add `index.ts`, and add `order.service.test.ts` using the in-memory repositories.

## 5. Logger

Create `src/observability/loggers/orders/order.logger.ts` with one method per event:

```ts
onOrderCreated(logger: FastifyBaseLogger): void {
  logger.info({ event: 'order.created' }, 'order created');
}
```

Add `index.ts`, and re-export it from `src/observability/loggers/index.ts`.

## 6. Plugin

Create `src/plugins/order.ts`. Copy `src/plugins/item.ts` and:

- Extend `declare module 'fastify'` with `orderLogger`, `orderRepository`, and `orderService`.
- List every plugin whose decorators you use in `dependencies`. For example, if `OrderService` needs `fastify.itemRepository`, list `['@fastify/postgres', 'item']`.

Register the plugin in `src/app.ts`, after the plugins it depends on.

## 7. Schemas

Create `src/routes/orders/orders.schemas.ts`:

```ts
export const orderParamsSchema = z.object({ orderId: z.uuid() });

export const createOrderBodySchema = z.strictObject({
  itemId: z.uuid(),
  quantity: z.number().int().min(1)
});

export type OrderParams = z.infer<typeof orderParamsSchema>;
export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
```

Remember to use `z.coerce.number()` for any numeric field in `querystring` or `params`.

## 8. Handlers

Create `src/handlers/orders/orders.ts`:

```ts
export async function createOrderHandler(
  request: FastifyRequest<{ Body: CreateOrderBody }>,
  reply: FastifyReply
): Promise<FastifyReply> {
  const order = await request.server.orderService.createOrder(request.body);
  request.server.orderLogger.onOrderCreated(request.log);
  return reply.code(201).send(success(order));
}
```

Add `index.ts`, and re-export it from `src/handlers/index.ts`.

## 9. Router

Create `src/routes/orders/orders.ts`, exporting `ordersRouter`. Give every route a `description` and `tags: ['orders']` so it shows up well in Swagger.

Add `index.ts`, re-export it from `src/routes/index.ts`, and register it in `src/app.ts`:

```ts
app.register(routes.ordersRouter);
```

## 10. Tests and docs

- Add route validation cases to `src/app.test.ts`. Use `app.inject` with bad params and bodies, and expect a 400 `validation_error`.
- Add the new endpoints to the API list in `README.md`.
- Run `npm run check`.
