import { randomUUID } from 'node:crypto';
import { STATUS_CODES } from 'node:http';
import postgres from '@fastify/postgres';
import fastifyRequestContext from '@fastify/request-context';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler
} from '@fastify/type-provider-zod';
import fastify, { FastifyInstance } from 'fastify';
import { config } from './config';
import itemPlugin from './plugins/item';
import { AppError, ERROR_DEFINITIONS } from './shared/errors';
import { failure } from './shared/response';
import * as routes from './routes';

function isValidationError(error: unknown): error is { validation: unknown } {
  return typeof error === 'object' && error !== null && 'validation' in error;
}

// Fastify gives its own request errors (bad JSON, wrong content type, body too large) a 4xx
// status code. Returns that status, or undefined for anything else.
function getClientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) {
    return undefined;
  }

  const { statusCode } = error;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
    ? statusCode
    : undefined;
}

// 415 -> 'unsupported_media_type'
function toErrorName(statusCode: number): string {
  return (STATUS_CODES[statusCode] ?? 'client_error').toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

export function setupApp(): FastifyInstance {
  const app = fastify({
    logger: {
      level: config.LOGGER_LEVEL
    },
    requestIdHeader: config.REQUEST_ID_HEADER,
    genReqId: () => randomUUID()
  });

  // Route schemas are Zod schemas. Zod validates requests (and responses, when a route declares a
  // response schema) instead of Fastify's default Ajv compiler.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Fastify resolves request.id from the configured incoming header, or generates
  // one with genReqId when the header is missing. This only reflects that final
  // ID back to the caller for cross-service debugging.
  app.addHook('onRequest', async (request, reply) => {
    reply.header(config.REQUEST_ID_HEADER, request.id);
  });

  app.setErrorHandler((error, request, reply) => {
    if (isValidationError(error)) {
      const definition = ERROR_DEFINITIONS.validationError;
      return reply
        .code(definition.statusCode)
        .send(failure(definition.code, definition.name, 'Request validation failed'));
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(failure(error.code, error.name, error.message));
    }

    const clientErrorStatus = getClientErrorStatus(error);
    if (clientErrorStatus !== undefined) {
      return reply
        .code(clientErrorStatus)
        .send(
          failure(
            1000 + clientErrorStatus,
            toErrorName(clientErrorStatus),
            (error as Error).message
          )
        );
    }

    // request.log adds the request ID to the log line.
    request.log.error(error);
    const definition = ERROR_DEFINITIONS.internalError;
    return reply
      .code(definition.statusCode)
      .send(failure(definition.code, definition.name, 'Unexpected server error'));
  });

  app.setNotFoundHandler((request, reply) => {
    const definition = ERROR_DEFINITIONS.notFound;
    return reply
      .code(definition.statusCode)
      .send(
        failure(
          definition.code,
          definition.name,
          `Route ${request.method} ${request.url} not found`
        )
      );
  });

  // Remembers each request's logger while the request runs, so services can log with its
  // request ID without being passed the request. See src/observability/loggers/request-logger.ts.
  app.register(fastifyRequestContext, {
    defaultStoreValues: (request) => ({ log: request.log })
  });

  app.register(postgres, config.DATABASE);

  app.register(swagger, {
    openapi: {
      info: {
        title: 'Fastify Service Template API',
        version: '0.1.0'
      }
    },
    // Converts Zod route schemas into JSON Schema for the OpenAPI document.
    transform: jsonSchemaTransform
  });

  app.register(swaggerUi, {
    routePrefix: '/docs'
  });

  app.register(itemPlugin);

  app.register(routes.healthcheckRouter);
  app.register(routes.itemsRouter);

  return app;
}
