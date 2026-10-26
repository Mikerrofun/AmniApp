import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { apiTemplateFormSchema } from '../../src/schemas/api-template';

const validForm = {
  name: 'My template',
  provider: 'openai' as const,
  model: 'gpt-4.1-mini',
  apiKey: 'sk-test',
};

describe('apiTemplateFormSchema', () => {
  it('валидная форма проходит проверку', () => {
    assert.equal(apiTemplateFormSchema.safeParse(validForm).success, true);
  });

  it('короткий ключ проходит проверку — длина ключа не ограничена', () => {
    const parsed = apiTemplateFormSchema.safeParse({
      ...validForm,
      apiKey: 'abc123',
    });

    assert.equal(parsed.success, true);
  });

  it('пустое имя, модель или ключ — ошибка', () => {
    for (const field of ['name', 'model', 'apiKey'] as const) {
      const parsed = apiTemplateFormSchema.safeParse({
        ...validForm,
        [field]: '',
      });

      assert.equal(parsed.success, false, `field: ${field}`);
    }
  });

  it('неизвестный провайдер — ошибка', () => {
    const parsed = apiTemplateFormSchema.safeParse({
      ...validForm,
      provider: 'anthropic',
    });

    assert.equal(parsed.success, false);
  });
});
