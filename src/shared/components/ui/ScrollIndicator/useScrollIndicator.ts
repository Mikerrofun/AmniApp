import { useCallback, useState } from "react";
import type { LayoutChangeEvent, NativeSyntheticEvent } from "react-native";

import { OVERFLOW_EPSILON, THUMB_MIN_HEIGHT } from "./ScrollIndicator.config";

type ScrollMetrics = {
  contentOffset: { y: number };
  contentSize?: { height?: number };
};

type ContentSizeEvent = {
  nativeEvent: { contentSize: { width: number; height: number } };
};

type UseScrollIndicatorOptions = {
  /** Отступ сверху и снизу для индикатора (чтобы не упирался в края) */
  verticalPadding?: number;
};

/**
 * Математика тонкого индикатора прокрутки: по размеру вьюпорта,
 * высоте контента и смещению считает видимость, высоту и позицию
 * «тумбы». Подходит и для TextInput (onScroll/onContentSizeChange),
 * и для списков (SectionList/FlatList/ScrollView).
 */
export function useScrollIndicator(options: UseScrollIndicatorOptions = {}) {
  const { verticalPadding = 4 } = options;
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const onScroll = useCallback((event: NativeSyntheticEvent<ScrollMetrics>) => {
    const newOffsetY = event.nativeEvent.contentOffset.y;
    setOffsetY(newOffsetY);

    // Для TextInput contentSize может приходить в onScroll
    const height = event.nativeEvent.contentSize?.height;
    if (height != null && height > 0) {
      setContentHeight(height);
    }
  }, []);

  const onContentSizeChange = useCallback((event: ContentSizeEvent) => {
    const height = event.nativeEvent.contentSize.height;
    if (height > 0) {
      setContentHeight(height);
    }
  }, []);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height > 0) {
      setViewportHeight(height);
    }
  }, []);

  const isOverflow = contentHeight > viewportHeight + OVERFLOW_EPSILON;

  // Уменьшаем рабочую высоту на отступы сверху и снизу
  const trackHeight = Math.max(0, viewportHeight - verticalPadding * 2);

  const thumbHeight = isOverflow
    ? Math.max(THUMB_MIN_HEIGHT, (viewportHeight / contentHeight) * trackHeight)
    : 0;

  const maxScroll = Math.max(1, contentHeight - viewportHeight);
  const progress = Math.min(1, Math.max(0, offsetY / maxScroll));

  // thumbTop учитывает верхний отступ и ограничивает движение
  const thumbTop = isOverflow
    ? verticalPadding + progress * (trackHeight - thumbHeight)
    : verticalPadding;

  return {
    isVisible: isOverflow,
    thumbHeight,
    thumbTop,
    onScroll,
    onContentSizeChange,
    onLayout,
  };
}
