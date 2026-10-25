import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MODEL_REQUIRES_API_KEY_MESSAGE,
  apiTemplateFormSchema,
} from '../../src/schemas/api-template';

const validForm = {
  name: 'My template',
  provider: 'openai' as const,
  model: 'gpt-4.1-mini',
  apiKey: 'sk-test',
};

describe('apiTemplateFormSchema superRefine', () => {
  it('модель без ключа — ошибка на поле apiKey', () => {
    const parsed = apiTemplateFormSchema.safeParse({
      ...validForm,
      model: 'gpt-4.1-mini',
      apiKey: '',
    });

    assert.equal(parsed.success, false);

    if (!parsed.success) {
      const issue = parsed.error.issues.find(
        (item) => item.message === MODEL_REQUIRES_API_KEY_MESSAGE,
      );

      assert.ok(issue);
      assert.deepEqual(issue.path, ['apiKey']);
    }
  });

  it('модель с ключом проходит валидацию', () => {
    const parsed = apiTemplateFormSchema.safeParse(validForm);

    assert.equal(parsed.success, true);
  });

  it('пустая модель без ключа — правило не срабатывает', () => {
    const parsed = apiTemplateFormSchema.safeParse({
      ...validForm,
      model: '',
      apiKey: '',
    });

    assert.equal(parsed.success, false);

    if (!parsed.success) {
      assert.equal(
        parsed.error.issues.some(
          (item) => item.message === MODEL_REQUIRES_API_KEY_MESSAGE,
        ),
        false,
      );
    }
  });
});
