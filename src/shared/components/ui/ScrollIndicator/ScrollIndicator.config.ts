/** Минимальная высота «тумбы» индикатора прокрутки */
export const THUMB_MIN_HEIGHT = 18;

/** Максимальная высота «тумбы» индикатора прокрутки */
export const THUMB_MAX_HEIGHT = 80;

/** Допуск при сравнении высоты контента и вьюпорта */
export const OVERFLOW_EPSILON = 1;

/** Толщина полоски индикатора */
export const THUMB_WIDTH = 3;

/** Цвет полоски индикатора (белосерый, полупрозрачный) */
export const THUMB_COLOR = "rgba(255, 255, 255, 0.28)";

/** Длительность «догоняния» тумбой позиции скролла (плавность хода) */
export const THUMB_SMOOTHING_DURATION = 120;

/** Время fade-in тумбы при начале прокрутки */
export const THUMB_FADE_IN_DURATION = 80;

/** Время fade-out тумбы после простоя */
export const THUMB_FADE_OUT_DURATION = 250;

/** Пауза после последнего события прокрутки перед скрытием тумбы */
export const THUMB_HIDE_DELAY = 900;
