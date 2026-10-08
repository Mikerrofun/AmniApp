/**
 * Конфигурация навигационных ссылок для переключателя
 */
export const navLinks = [
  { key: 'chat', label: 'Чат', href: '/chat' },
  { key: 'api', label: 'API', href: '/api' },
  { key: 'check', label: 'FastCheck', href: '/check' },
] as const;

/**
 * Тип ключа навигационной ссылки
 */
export type NavLinkKey = (typeof navLinks)[number]['key'];

/**
 * Тип навигационной ссылки
 */
export type NavLink = (typeof navLinks)[number];
