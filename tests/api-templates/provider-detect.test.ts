import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  matchProviders,
  resolveProvider,
} from '../../src/shared/lib/ai/provider-detect/detect/provider-detect';

import type { ModelsFetcher } from '../../src/shared/lib/ai/models-fetcher/fetchers/models-fetcher.types';

/** Резолвер, который не должен вызываться (детект без probe) */
const noCallResolver = () => {
  throw new Error('resolveFetcher should not be called');
};

const okFetcherWith =
  (models: string[]): ModelsFetcher =>
  () =>
    Promise.resolve({ ok: true, models });

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
  it('один кандидат — resolved без запроса, models пустой', async () => {
    const result = await resolveProvider(
      'sk-ant-' + 'a'.repeat(20),
      noCallResolver,
    );

    assert.deepEqual(result, {
      status: 'resolved',
      providerId: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1',
      models: [],
    });
  });

  it('коллизия — победитель probe возвращает свои models', async () => {
    const result = await resolveProvider(
      'sk-' + 'a'.repeat(20),
      (providerId) =>
        providerId === 'openai'
          ? okFetcherWith(['gpt-4o'])
          : failFetcher,
    );

    assert.deepEqual(result, {
      status: 'resolved',
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      models: ['gpt-4o'],
    });
  });

  it('коллизия — все probe неуспешны, failed', async () => {
    const result = await resolveProvider(
      'sk-' + 'a'.repeat(20),
      () => failFetcher,
    );

    assert.deepEqual(result, { status: 'failed' });
  });

  it('коллизия — probe идет фетчером конкретного кандидата', async () => {
    const calledWith: string[] = [];

    await resolveProvider('sk-' + 'a'.repeat(20), (providerId) => {
      calledWith.push(providerId);

      return failFetcher;
    });

    assert.deepEqual(calledWith.sort(), ['deepseek', 'openai']);
  });

  it('неизвестный префикс — unknown', async () => {
    const result = await resolveProvider(
      'xyz_' + 'a'.repeat(20),
      noCallResolver,
    );

    assert.deepEqual(result, { status: 'unknown' });
  });

  it('короткий ключ — unknown без запроса', async () => {
    const result = await resolveProvider('sk-short', noCallResolver);

    assert.deepEqual(result, { status: 'unknown' });
  });
});
