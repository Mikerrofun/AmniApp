import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeModelList } from './normalize-models';

describe('normalizeModelList', () => {
  it('извлекает data[].id, делает trim, dedup и сортировку', () => {
    const result = normalizeModelList({
      data: [
        { id: 'gpt-4.1-mini' },
        { id: ' claude-3 ' },
        { id: 'gpt-4.1-mini' },
        { id: 'gpt-4o' },
      ],
    });

    assert.deepEqual(result, ['claude-3', 'gpt-4.1-mini', 'gpt-4o']);
  });

  it('отбрасывает не-строки и пустые id', () => {
    const result = normalizeModelList({
      data: [{ id: 42 }, { id: null }, {}, { id: '   ' }, { id: 'm1' }],
    });

    assert.deepEqual(result, ['m1']);
  });

  it('возвращает пустой список для неожидаемого формата', () => {
    assert.deepEqual(normalizeModelList(null), []);
    assert.deepEqual(normalizeModelList({}), []);
    assert.deepEqual(normalizeModelList({ data: 'nope' }), []);
  });
});
