import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseOpenaiModelList } from '../../src/shared/lib/ai/models-fetcher/parsers/parse-openai-models';

describe('parseOpenaiModelList', () => {
  it('извлекает data[].id, делает trim, dedup и сортировку', () => {
    const result = parseOpenaiModelList({
      data: [
        { id: 'gpt-4.1-mini' },
        { id: ' claude-3 ' },
        { id: 'gpt-4.1-mini' },
        { id: 'gpt-4o' },
      ],
    });

    assert.deepEqual(result, ['claude-3', 'gpt-4.1-mini', 'gpt-4o']);
  });

  it('срезает ведущий «~» и «~/» и схлопывает дубли после среза', () => {
    const result = parseOpenaiModelList({
      data: [
        { id: '~/gpt-4o' },
        { id: '~claude-3' },
        { id: 'gpt-4o' },
        { id: '~~weird' },
      ],
    });

    assert.deepEqual(result, ['~weird', 'claude-3', 'gpt-4o']);
  });

  it('отбрасывает не-строки и пустые id', () => {
    const result = parseOpenaiModelList({
      data: [{ id: 42 }, { id: null }, {}, { id: '   ' }, { id: 'm1' }],
    });

    assert.deepEqual(result, ['m1']);
  });

  it('возвращает пустой список для неожидаемого формата', () => {
    assert.deepEqual(parseOpenaiModelList(null), []);
    assert.deepEqual(parseOpenaiModelList({}), []);
    assert.deepEqual(parseOpenaiModelList({ data: 'nope' }), []);
  });
});
