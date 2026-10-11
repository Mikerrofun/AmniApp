import { useCallback, useState } from 'react';
import type {
  LayoutChangeEvent,
  NativeSyntheticEvent,
} from 'react-native';

import { OVERFLOW_EPSILON, THUMB_MIN_HEIGHT } from './ScrollIndicator.config';

type ScrollMetrics = {
  contentOffset: { y: number };
  contentSize?: { height?: number };
};

type ContentSizeEvent = {
  nativeEvent: { contentSize: { width: number; height: number } };
};

/**
 * Математика тонкого индикатора прокрутки: по размеру вьюпорта,
 * высоте контента и смещению считает видимость, высоту и позицию
 * «тумбы». Подходит и для TextInput (onScroll/onContentSizeChange),
 * и для списков (SectionList/FlatList/ScrollView).
 */
export function useScrollIndicator() {
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<ScrollMetrics>) => {
      setOffsetY(event.nativeEvent.contentOffset.y);

      const height = event.nativeEvent.contentSize?.height;
      if (height != null) setContentHeight(height);
    },
    [],
  );

  const onContentSizeChange = useCallback((event: ContentSizeEvent) => {
    setContentHeight(event.nativeEvent.contentSize.height);
  }, []);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setViewportHeight(event.nativeEvent.layout.height);
  }, []);

  const isOverflow = contentHeight > viewportHeight + OVERFLOW_EPSILON;

  const thumbHeight = isOverflow
    ? Math.max(
        THUMB_MIN_HEIGHT,
        (viewportHeight / contentHeight) * viewportHeight,
      )
    : 0;

  const maxScroll = Math.max(1, contentHeight - viewportHeight);
  const progress = Math.min(1, Math.max(0, offsetY / maxScroll));
  const thumbTop = isOverflow
    ? progress * (viewportHeight - thumbHeight)
    : 0;

  return {
    isVisible: isOverflow,
    thumbHeight,
    thumbTop,
    onScroll,
    onContentSizeChange,
    onLayout,
  };
}
