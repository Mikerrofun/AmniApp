import type { StyleProps } from 'react-native-reanimated';

export type ScrollIndicatorSide = 'left' | 'right';

export type ScrollIndicatorProps = {
  /**
   * Анимированный стиль тумбы из useScrollIndicator (top/height/opacity).
   * Считается на UI-потоке из shared values — без ре-рендеров при скролле.
   */
  style: StyleProps;
  /** Сторона, у которой рисуется полоска */
  side?: ScrollIndicatorSide;
  /** Отступ полоски от края контейнера */
  inset?: number;
};
