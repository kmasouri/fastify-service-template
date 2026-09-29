import { FastifyBaseLogger } from 'fastify';

export class ItemLogger {
  onItemCreated(logger: FastifyBaseLogger): void {
    logger.info({ event: 'item.created' }, 'item created');
  }

  onItemListed(logger: FastifyBaseLogger): void {
    logger.info({ event: 'item.listed' }, 'items listed');
  }

  onItemFetched(logger: FastifyBaseLogger): void {
    logger.info({ event: 'item.fetched' }, 'item fetched');
  }
}
