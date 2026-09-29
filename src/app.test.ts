import { setupApp } from './app';

describe('app routes', () => {
  it('returns the healthcheck response', async () => {
    const app = setupApp();

    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      data: {
        status: 'ok'
      }
    });
    await app.close();
  });

  it('serves Swagger UI', async () => {
    const app = setupApp();

    const response = await app.inject({
      method: 'GET',
      url: '/docs'
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    await app.close();
  });

  it('converts Zod route schemas into the OpenAPI document', async () => {
    const app = setupApp();

    const response = await app.inject({
      method: 'GET',
      url: '/docs/json'
    });

    expect(response.statusCode).toBe(200);
    const document = response.json();
    expect(
      document.paths['/items'].post.requestBody.content['application/json'].schema
    ).toMatchObject({
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', minLength: 1 }
      }
    });
    await app.close();
  });

  it('uses an incoming request id header when provided', async () => {
    const app = setupApp();
    const requestId = 'external-trace-id-123';

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-request-id': requestId
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe(requestId);
    await app.close();
  });

  it('generates a UUID request id when none is provided', async () => {
    const app = setupApp();

    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    await app.close();
  });

  it.each([
    ['an invalid path param', { method: 'GET' as const, url: '/items/not-a-uuid' }],
    ['an out-of-range query param', { method: 'GET' as const, url: '/items?limit=500' }],
    [
      'a body with a missing required field',
      { method: 'POST' as const, url: '/items', payload: { description: 'no name' } }
    ],
    [
      'a body with an unknown field',
      { method: 'POST' as const, url: '/items', payload: { name: 'Widget', extra: true } }
    ]
  ])('returns validation errors through the shared error handler for %s', async (_, request) => {
    const app = setupApp();

    const response = await app.inject(request);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      success: false,
      error: {
        code: 1400,
        name: 'validation_error',
        message: 'Request validation failed'
      }
    });
    await app.close();
  });
});
