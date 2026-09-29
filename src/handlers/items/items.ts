import { FastifyReply, FastifyRequest } from 'fastify';
import type { CreateItemBody, ItemParams, ListItemsQuery } from '../../routes/items/items.schemas';
import { success } from '../../shared/response';

export async function createItemHandler(
  request: FastifyRequest<{ Body: CreateItemBody }>,
  reply: FastifyReply
): Promise<FastifyReply> {
  const item = await request.server.itemService.createItem(request.body);
  request.server.itemLogger.onItemCreated(request.log);
  return reply.code(201).send(success(item));
}

export async function listItemsHandler(
  request: FastifyRequest<{ Querystring: ListItemsQuery }>
): Promise<unknown> {
  const items = await request.server.itemService.listItems(request.query);
  request.server.itemLogger.onItemListed(request.log);
  return success(items);
}

export async function getItemHandler(
  request: FastifyRequest<{ Params: ItemParams }>
): Promise<unknown> {
  const item = await request.server.itemService.getItem(request.params.itemId);
  request.server.itemLogger.onItemFetched(request.log);
  return success(item);
}
