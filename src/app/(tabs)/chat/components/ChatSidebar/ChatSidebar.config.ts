/**
 * Конфигурация ChatSidebar
 * Константы для анимаций, отступов и размеров
 */

/** Длительность анимации открытия/закрытия панели (мс) */
export const ANIMATION_DURATION = 260;

/**
 * Отступ сверху для контента панели
 * Контент панели начинается ниже кнопки-триггера (12 + 30 + зазор)
 */
export const CONTENT_TOP_OFFSET = 56;

/** Радиус скругления нижних углов панели */
export const PANEL_BOTTOM_RADIUS = 16;

/** Ширина экрана (px), начиная с которой режим считается десктопным */
export const SIDEBAR_DESKTOP_BREAKPOINT = 900;

/** Доля ширины экрана для панели на мобильных устройствах (0.7 = 70%) */
export const SIDEBAR_MOBILE_RATIO = 0.7;

/** Минимальная ширина панели на мобильных устройствах (px) */
export const SIDEBAR_MOBILE_MIN_WIDTH = 240;

/** Фиксированная ширина панели на десктопе (px) */
export const SIDEBAR_DESKTOP_WIDTH = 280;
