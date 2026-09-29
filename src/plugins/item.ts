import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { ItemPostgresRepository, ItemRepository } from '../data';
import { ItemLogger } from '../observability';
import { ItemService } from '../services/items';

declare module 'fastify' {
  interface FastifyInstance {
    itemRepository: ItemRepository;
    itemService: ItemService;
  }
}

const itemPlugin: FastifyPluginAsync = async (fastify) => {
  const itemRepository = new ItemPostgresRepository(fastify.pg);
  const itemService = new ItemService(itemRepository, new ItemLogger(fastify.log));

  fastify.decorate('itemRepository', itemRepository);
  fastify.decorate('itemService', itemService);
};

export default fp(itemPlugin, {
  name: 'item',
  dependencies: ['@fastify/postgres', '@fastify/request-context']
});
