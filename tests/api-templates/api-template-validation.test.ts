import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  apiTemplateFormSchema,
  createApiTemplateFormSchema,
} from '../../src/schemas/api-template';

const validForm = {
  name: 'My template',
  provider: 'openai' as const,
  baseUrl: '',
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
      provider: 'mistral',
    });

    assert.equal(parsed.success, false);
  });

  it('расширенный enum: провайдеры реестра проходят проверку', () => {
    for (const provider of [
      'openai',
      'openrouter',
      'deepseek',
      'groq',
      'perplexity',
      'huggingface',
      'gemini',
      'anthropic',
      'cohere',
      'custom',
    ] as const) {
      const parsed = apiTemplateFormSchema.safeParse({
        ...validForm,
        provider,
      });

      assert.equal(parsed.success, true, `provider: ${provider}`);
    }
  });

  it('невалидный baseUrl — ошибка', () => {
    const parsed = apiTemplateFormSchema.safeParse({
      ...validForm,
      baseUrl: 'not-a-url',
    });

    assert.equal(parsed.success, false);
  });
});

describe('createApiTemplateFormSchema (ручной режим)', () => {
  it('ручной режим без baseUrl — ошибка на поле baseUrl', () => {
    const parsed = createApiTemplateFormSchema({
      baseUrlRequired: true,
    }).safeParse(validForm);

    assert.equal(parsed.success, false);

    if (!parsed.success) {
      assert.deepEqual(
        parsed.error.issues.map((issue) => issue.path.join('.')),
        ['baseUrl'],
      );
    }
  });

  it('ручной режим с валидным baseUrl — проходит', () => {
    const parsed = createApiTemplateFormSchema({
      baseUrlRequired: true,
    }).safeParse({
      ...validForm,
      provider: 'custom',
      baseUrl: 'https://api.example.com/v1',
    });

    assert.equal(parsed.success, true);
  });

  it('resolved-детект: baseUrl из реестра, правило не срабатывает', () => {
    const parsed = createApiTemplateFormSchema({
      baseUrlRequired: false,
    }).safeParse(validForm);

    assert.equal(parsed.success, true);
  });
});
