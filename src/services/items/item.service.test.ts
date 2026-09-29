import { InMemoryItemRepository } from '../../data/items/in-memory-item.repository.test-helper';
import { ItemService } from './item.service';

describe('ItemService', () => {
  it('creates items with defaults', async () => {
    const service = new ItemService(new InMemoryItemRepository());

    const item = await service.createItem({ name: 'Widget' });

    expect(item).toMatchObject({
      name: 'Widget',
      description: null,
      metadata: {}
    });
    await expect(service.getItem(item.id)).resolves.toMatchObject({ id: item.id });
  });

  it('rejects duplicate item names case-insensitively', async () => {
    const service = new ItemService(new InMemoryItemRepository());
    await service.createItem({ name: 'Widget' });

    await expect(service.createItem({ name: 'WIDGET' })).rejects.toMatchObject({
      statusCode: 409
    });
  });

  it('lists items by name with limit and offset', async () => {
    const service = new ItemService(new InMemoryItemRepository());
    await service.createItem({ name: 'Charlie' });
    await service.createItem({ name: 'Alpha' });
    await service.createItem({ name: 'Bravo' });

    const items = await service.listItems({ limit: 2, offset: 1 });

    expect(items.map((item) => item.name)).toEqual(['Bravo', 'Charlie']);
  });

  it('throws not found for missing items', async () => {
    const service = new ItemService(new InMemoryItemRepository());

    await expect(service.getItem('00000000-0000-4000-8000-000000000001')).rejects.toMatchObject({
      statusCode: 404
    });
  });
});
