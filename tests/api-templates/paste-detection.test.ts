import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isPasteLikeInsertion } from '../../src/shared/lib/ai/provider-detect/paste-detection';

describe('isPasteLikeInsertion', () => {
  it('вставка в пустое поле — вставка', () => {
    assert.equal(isPasteLikeInsertion('', 'sk-ant-api03-xxxx'), true);
  });

  it('рост больше одного символа — вставка', () => {
    assert.equal(isPasteLikeInsertion('sk-', 'sk-ant-api03'), true);
  });

  it('не продолжает предыдущее (автозаполнение, замена) — вставка', () => {
    assert.equal(isPasteLikeInsertion('sk-old-key-123456', 'gsk_new_key'), true);
  });

  it('вставка в середину значения — вставка', () => {
    assert.equal(isPasteLikeInsertion('sk-abc', 'sk-XYZabc'), true);
  });

  it('посимвольный ввод — не вставка', () => {
    assert.equal(isPasteLikeInsertion('sk-', 'sk-a'), false);
    assert.equal(isPasteLikeInsertion('sk-a', 'sk-ab'), false);
  });

  it('удаление — не вставка', () => {
    assert.equal(isPasteLikeInsertion('sk-abc', 'sk-ab'), false);
    assert.equal(isPasteLikeInsertion('sk-abc', ''), false);
  });

  it('зажатый backspace (много удалений) — не вставка', () => {
    assert.equal(isPasteLikeInsertion('sk-ant-api03-xxxx', 'sk-'), false);
  });

  it('автозаполнение более коротким значением — вставка', () => {
    assert.equal(isPasteLikeInsertion('sk-old-key-123456', 'gsk_new'), true);
  });

  it('замена одного символа той же длины — не вставка', () => {
    assert.equal(isPasteLikeInsertion('sk-abc', 'sk-abd'), false);
  });

  it('значение не изменилось — не вставка', () => {
    assert.equal(isPasteLikeInsertion('sk-abc', 'sk-abc'), false);
  });
});
