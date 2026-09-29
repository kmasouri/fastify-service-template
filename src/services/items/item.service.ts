import { ItemRepository } from '../../data';
import { ItemLogger } from '../../observability';
import { ConflictError, NotFoundError } from '../../shared/errors';
import { Item } from '../../shared/types';

export class ItemService {
  constructor(
    private readonly itemRepository: ItemRepository,
    private readonly itemLogger: ItemLogger
  ) {}

  async createItem(input: {
    name: string;
    description?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<Item> {
    const existing = await this.itemRepository.getByName(input.name);
    if (existing) {
      throw new ConflictError(`Item ${input.name} already exists`);
    }

    const item = await this.itemRepository.create({
      name: input.name,
      description: input.description ?? null,
      metadata: input.metadata ?? {}
    });
    this.itemLogger.onItemCreated();
    return item;
  }

  async listItems(input: { limit: number; offset: number }): Promise<Item[]> {
    const items = await this.itemRepository.list(input);
    this.itemLogger.onItemListed();
    return items;
  }

  async getItem(itemId: string): Promise<Item> {
    const item = await this.itemRepository.getById(itemId);
    if (!item) {
      throw new NotFoundError(`Item ${itemId} was not found`);
    }

    this.itemLogger.onItemFetched();
    return item;
  }
}
