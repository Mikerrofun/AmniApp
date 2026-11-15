import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  matchProviders,
  resolveProvider,
} from '../../src/shared/lib/ai/provider-detect/provider-detect';

import type { ModelsFetcher } from '../../src/shared/lib/ai/models-fetcher/models-fetcher.types';

/** Фетчер, который не должен вызываться (детект без probe) */
const noCallFetcher: ModelsFetcher = () => {
  throw new Error('fetchAvailableModels should not be called');
};

const okFetcher: ModelsFetcher = () =>
  Promise.resolve({ ok: true, models: ['model-a'] });

const failFetcher: ModelsFetcher = () =>
  Promise.resolve({ ok: false, reason: 'unauthorized' });

describe('matchProviders', () => {
  it('уникальный префикс — один кандидат', () => {
    const candidates = matchProviders('gsk_' + 'a'.repeat(20));

    assert.deepEqual(
      candidates.map((candidate) => candidate.id),
      ['groq'],
    );
  });

  it('sk-or-v1- — только OpenRouter (longest-prefix)', () => {
    const candidates = matchProviders('sk-or-v1-' + 'a'.repeat(20));

    assert.deepEqual(
      candidates.map((candidate) => candidate.id),
      ['openrouter'],
    );
  });

  it('sk- — коллизия [openai, deepseek]', () => {
    const candidates = matchProviders('sk-' + 'a'.repeat(20));

    assert.deepEqual(
      candidates.map((candidate) => candidate.id),
      ['openai', 'deepseek'],
    );
  });

  it('sk-ant- — anthropic (длинный префикс бьется раньше sk-)', () => {
    const candidates = matchProviders('sk-ant-' + 'a'.repeat(20));

    assert.deepEqual(
      candidates.map((candidate) => candidate.id),
      ['anthropic'],
    );
  });

  it('неизвестный ключ — пусто', () => {
    assert.equal(matchProviders('xyz_' + 'a'.repeat(20)).length, 0);
  });
});

describe('resolveProvider', () => {
  it('один кандидат — resolved без запроса', async () => {
    const result = await resolveProvider(
      'sk-ant-' + 'a'.repeat(20),
      noCallFetcher,
    );

    assert.deepEqual(result, {
      status: 'resolved',
      providerId: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
    });
  });

  it('коллизия — первый успешный probe побеждает', async () => {
    const result = await resolveProvider('sk-' + 'a'.repeat(20), okFetcher);

    assert.equal(result.status, 'resolved');
  });

  it('коллизия — все probe неуспешны, failed', async () => {
    const result = await resolveProvider('sk-' + 'a'.repeat(20), failFetcher);

    assert.deepEqual(result, { status: 'failed' });
  });

  it('неизвестный префикс — unknown', async () => {
    const result = await resolveProvider(
      'xyz_' + 'a'.repeat(20),
      noCallFetcher,
    );

    assert.deepEqual(result, { status: 'unknown' });
  });

  it('короткий ключ — unknown без запроса', async () => {
    const result = await resolveProvider('sk-short', noCallFetcher);

    assert.deepEqual(result, { status: 'unknown' });
  });
});
