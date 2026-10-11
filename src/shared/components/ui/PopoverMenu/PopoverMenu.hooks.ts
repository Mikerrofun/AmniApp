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
 */
export function usePopoverAnchor() {
  const anchorRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);

  const measure = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
    });
  }, []);

  return { anchorRef, anchor, measure };
}

/**
 * Позиция popover'а относительно якоря с прижатием к границам окна.
 */
export function usePopoverPosition(
  anchor: PopoverAnchor | null,
  width: number,
  placement: PopoverPlacement,
  windowWidth: number,
  windowHeight: number,
) {
  return useMemo(() => {
    if (!anchor) return null;

    const rawLeft =
      placement === 'bottom-end' ? anchor.x + anchor.width - width : anchor.x;

    const maxLeft = Math.max(
      windowWidth - width - POPOVER_SCREEN_MARGIN,
      POPOVER_SCREEN_MARGIN,
    );

    const left = Math.min(Math.max(rawLeft, POPOVER_SCREEN_MARGIN), maxLeft);
    const top = Math.min(
      anchor.y + anchor.height + POPOVER_GAP,
      windowHeight - POPOVER_SCREEN_MARGIN,
    );

    return { left, top };
  }, [anchor, width, placement, windowWidth, windowHeight]);
}
