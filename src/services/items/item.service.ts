import { ItemRepository } from '../../data';
import { ItemLogger } from '../../observability';
import { AppError } from '../../shared/errors';
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
      throw new AppError('itemNameTaken', `Item ${input.name} already exists`);
    }

    const item = await this.itemRepository.create({
      name: input.name,
      description: input.description ?? null,
      metadata: input.metadata ?? {}
    });
    this.itemLogger.onItemCreated();
    return item;
  }

  async listItems(input: {
    limit: number;
    offset: number;
  }): Promise<{ items: Item[]; total: number }> {
    const [items, total] = await Promise.all([
      this.itemRepository.list(input),
      this.itemRepository.count()
    ]);
    this.itemLogger.onItemListed();
    return { items, total };
  }

  async getItem(itemId: string): Promise<Item> {
    const item = await this.itemRepository.getById(itemId);
    if (!item) {
      throw new AppError('itemNotFound', `Item ${itemId} was not found`);
    }

    this.itemLogger.onItemFetched();
    return item;
  }
}
