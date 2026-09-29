import { randomUUID } from 'node:crypto';
import postgres from '@fastify/postgres';
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

  app.setErrorHandler((error, _request, reply) => {
    if (isValidationError(error)) {
      const definition = ERROR_DEFINITIONS.validationError;
      return reply
        .code(definition.statusCode)
        .send(failure(definition.code, definition.name, 'Request validation failed'));
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(failure(error.code, error.name, error.message));
    }

    app.log.error(error);
    const definition = ERROR_DEFINITIONS.internalError;
    return reply
      .code(definition.statusCode)
      .send(failure(definition.code, definition.name, 'Unexpected server error'));
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
