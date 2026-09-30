import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { ItemPostgresRepository } from '../data';
import { ItemLogger } from '../observability';
import { ItemService } from '../services';

declare module 'fastify' {
  interface FastifyInstance {
    itemService: ItemService;
  }
}

// Builds the item service with its repository and logger. Only the service is attached to
// Fastify: repositories are used by services and nothing else.
const itemPlugin: FastifyPluginAsync = async (fastify) => {
  const itemRepository = new ItemPostgresRepository(fastify.pg);
  const itemService = new ItemService(itemRepository, new ItemLogger(fastify.log));

  fastify.decorate('itemService', itemService);
};

export default fp(itemPlugin, {
  name: 'item',
  dependencies: ['@fastify/postgres', '@fastify/request-context']
});
