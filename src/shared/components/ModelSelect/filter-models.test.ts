import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { filterModels } from './filter-models';

const models = [
  'openai/gpt-4.1-mini',
  'anthropic/claude-3-haiku',
  'meta-llama/Llama-3',
];

describe('filterModels', () => {
  it('пустой запрос возвращает весь список', () => {
    assert.deepEqual(filterModels(models, ''), models);
    assert.deepEqual(filterModels(models, '   '), models);
  });

  it('case-insensitive подстрока в любом месте id', () => {
    assert.deepEqual(filterModels(models, 'GPT'), ['openai/gpt-4.1-mini']);
    assert.deepEqual(filterModels(models, 'llama'), [
      'meta-llama/Llama-3',
    ]);
    assert.deepEqual(filterModels(models, 'HAIKU'), [
      'anthropic/claude-3-haiku',
    ]);
  });

  it('нет совпадений — пустой список', () => {
    assert.deepEqual(filterModels(models, 'mistral'), []);
  });
});
