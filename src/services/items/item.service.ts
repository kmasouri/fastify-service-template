import { ItemRepository } from '../../data';
import { ConflictError, NotFoundError } from '../../shared/errors';
import { Item } from '../../shared/types';

export class ItemService {
  constructor(private readonly itemRepository: ItemRepository) {}

  async createItem(input: {
    name: string;
    description?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<Item> {
    const existing = await this.itemRepository.getByName(input.name);
    if (existing) {
      throw new ConflictError(`Item ${input.name} already exists`);
    }

    return this.itemRepository.create({
      name: input.name,
      description: input.description ?? null,
      metadata: input.metadata ?? {}
    });
  }

  listItems(input: { limit: number; offset: number }): Promise<Item[]> {
    return this.itemRepository.list(input);
  }

  async getItem(itemId: string): Promise<Item> {
    const item = await this.itemRepository.getById(itemId);
    if (!item) {
      throw new NotFoundError(`Item ${itemId} was not found`);
    }

    return item;
  }
}
