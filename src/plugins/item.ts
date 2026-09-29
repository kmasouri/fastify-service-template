import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { ItemPostgresRepository, ItemRepository } from '../data';
import { ItemLogger } from '../observability';
import { ItemService } from '../services/items';

declare module 'fastify' {
  interface FastifyInstance {
    itemLogger: ItemLogger;
    itemRepository: ItemRepository;
    itemService: ItemService;
  }
}

const itemPlugin: FastifyPluginAsync = async (fastify) => {
  const itemLogger = new ItemLogger();
  const itemRepository = new ItemPostgresRepository(fastify.pg);
  const itemService = new ItemService(itemRepository);

  fastify.decorate('itemLogger', itemLogger);
  fastify.decorate('itemRepository', itemRepository);
  fastify.decorate('itemService', itemService);
};

export default fp(itemPlugin, {
  name: 'item',
  dependencies: ['@fastify/postgres']
});
