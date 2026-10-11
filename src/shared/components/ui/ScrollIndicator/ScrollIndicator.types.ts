export type ScrollIndicatorSide = 'left' | 'right';

export type ScrollIndicatorProps = {
  /** Показывать индикатор (контент не влезает во вьюпорт) */
  isVisible: boolean;
  /** Высота «тумбы» в px */
  thumbHeight: number;
  /** Смещение «тумбы» от верха трека в px */
  thumbTop: number;
  /** Сторона, у которой рисуется полоска */
  side?: ScrollIndicatorSide;
  /** Отступ полоски от края контейнера */
  inset?: number;
};
