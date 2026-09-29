import { randomUUID } from 'node:crypto';
import { Item } from '../../shared/types';
import { CreateItemInput, ItemRepository, ListItemsInput } from './item.repository';

export class InMemoryItemRepository implements ItemRepository {
  private readonly items = new Map<string, Item>();

  async create(input: CreateItemInput): Promise<Item> {
    const now = new Date();
    const item: Item = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now
    };

    this.items.set(item.id, item);
    return item;
  }

  async list(input: ListItemsInput): Promise<Item[]> {
    return Array.from(this.items.values())
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(input.offset, input.offset + input.limit);
  }

  async getById(itemId: string): Promise<Item | null> {
    return this.items.get(itemId) ?? null;
  }

  async getByName(name: string): Promise<Item | null> {
    return (
      Array.from(this.items.values()).find(
        (item) => item.name.toLowerCase() === name.toLowerCase()
      ) ?? null
    );
  }
}
