import type { navLinks } from "./NavSwitch.config";

/**
 * Тип ключа навигационной ссылки
 */
export type NavLinkKey = (typeof navLinks)[number]["key"];

/**
 * Тип навигационной ссылки
 */
export type NavLink = (typeof navLinks)[number];
