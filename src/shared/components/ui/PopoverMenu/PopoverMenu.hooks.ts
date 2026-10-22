import { useCallback, useMemo, useRef, useState } from 'react';
import type { View } from 'react-native';

import type { PopoverAnchor, PopoverPlacement } from './PopoverMenu.types';

/** Зазор между якорем и popover'ом, px */
export const POPOVER_GAP = 4;

/** Ширина popover'а по умолчанию, px */
export const POPOVER_DEFAULT_WIDTH = 200;

/** Минимальный отступ popover'а от краев окна, px */
export const POPOVER_SCREEN_MARGIN = 8;

/**
 * Измерение якорного элемента для позиционирования popover'а.
 * anchorRef навешивается на якорную View, measure вызывается перед открытием.
 * setAnchor — для якорей, посчитанных вручную (например, с поправкой
 * на подъем клавиатурой).
 */
export function usePopoverAnchor() {
  const anchorRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);

  const measure = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  }, []);

  return { anchorRef, anchor, measure, setAnchor };
}

/**
 * Позиция popover'а относительно якоря с прижатием к границам окна.
 *
 * Для top-placement нужна высота контента: до первого onLayout берём
 * maxHeight как оценку (popover рендерится с opacity 0, скачка не видно).
 */
export function usePopoverPosition(
  anchor: PopoverAnchor | null,
  width: number,
  placement: PopoverPlacement,
  windowWidth: number,
  windowHeight: number,
  contentHeight: number | null = null,
  maxHeight: number | null = null,
) {
  return useMemo(() => {
    if (!anchor) return null;

    const isEnd = placement === 'bottom-end' || placement === 'top-end';
    const isTop = placement === 'top-end';

    const rawLeft = isEnd ? anchor.x + anchor.width - width : anchor.x;

    const maxLeft = Math.max(
      windowWidth - width - POPOVER_SCREEN_MARGIN,
      POPOVER_SCREEN_MARGIN,
    );

    const left = Math.min(Math.max(rawLeft, POPOVER_SCREEN_MARGIN), maxLeft);

    let top: number;
    if (isTop) {
      const height = contentHeight ?? maxHeight ?? 0;
      top = Math.max(POPOVER_SCREEN_MARGIN, anchor.y - POPOVER_GAP - height);
    } else {
      top = Math.min(
        anchor.y + anchor.height + POPOVER_GAP,
        windowHeight - POPOVER_SCREEN_MARGIN,
      );
    }

    return { left, top };
  }, [
    anchor,
    width,
    placement,
    windowWidth,
    windowHeight,
    contentHeight,
    maxHeight,
  ]);
}
