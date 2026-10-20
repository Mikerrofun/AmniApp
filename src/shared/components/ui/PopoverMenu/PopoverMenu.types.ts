import type { ReactNode } from 'react';

/** Координаты якорного элемента в окне (результат measureInWindow) */
export type PopoverAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Позиция popover'а относительно якоря */
export type PopoverPlacement = 'bottom-start' | 'bottom-end' | 'top-end';

export type PopoverMenuProps = {
  open: boolean;
  onClose: () => void;
  /** Координаты якоря в окне; null — popover не рендерится */
  anchor: PopoverAnchor | null;
  placement?: PopoverPlacement;
  /** Ширина popover'а, px */
  width?: number;
  /**
   * Максимальная высота контента, px. Превышение — внутренний ScrollView
   * с ScrollIndicator. Без значения popover растёт по контенту.
   */
  maxHeight?: number;
  children: ReactNode;
};
