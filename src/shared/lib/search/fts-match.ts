import { PREFIX_SEARCH_MIN_LENGTH } from './search.config';

/**
 * Собирает FTS5 MATCH-запрос из пользовательской строки: каждый токен
 * становится quoted-фразой (внутренние кавычки удваиваются), спецсимволы
 * FTS-синтаксиса внутри кавычек безопасны.
 *
 * Для токенов от 3 символов добавляется префиксный поиск (`"токен"*`),
 * чтобы «пролист» находил «пролистал» — unicode61 не делает стемминга.
 */
export function buildFtsMatchQuery(query: string): string {
  return query
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const quoted = `"${token.replace(/"/g, '""')}"`;

      return token.length >= PREFIX_SEARCH_MIN_LENGTH
        ? `${quoted}*`
        : quoted;
    })
    .join(' ');
}
