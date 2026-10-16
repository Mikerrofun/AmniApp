import type { LayoutChangeEvent, NativeSyntheticEvent } from "react-native";
import { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

import {
  OVERFLOW_EPSILON,
  THUMB_MAX_HEIGHT,
  THUMB_MIN_HEIGHT,
} from "./ScrollIndicator.config";
import type {
  ContentSizeEvent,
  ScrollMetrics,
  UseScrollIndicatorOptions,
} from "./ScrollIndicator.types";

/**
 * Колбэк пишет в shared value из JS-потока, отрисовка тумбы идёт
 * на UI-потоке. Колбэки не мемоизированы — компонент не ре-рендерится
 * при скролле, пересоздавать нечего.
 *
 * Хук намеренно не экспортирует resetScroll: правильное решение —
 * перемонтировать сам компонент со списком (через key), тогда shared
 * values получают чистые 0 при каждом монтировании без скачков.
 */
export function useScrollIndicator(options: UseScrollIndicatorOptions = {}) {
  const { verticalPadding = 4 } = options;

  const offsetY = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const contentHeight = useSharedValue(0);

  const onScroll = (event: NativeSyntheticEvent<ScrollMetrics>) => {
    offsetY.value = event.nativeEvent.contentOffset.y;

    // Для TextInput contentSize может приходить в onScroll
    const height = event.nativeEvent.contentSize?.height;
    if (height != null && height > 0) {
      contentHeight.value = height;
    }
  };

  const onContentSizeChange = (event: ContentSizeEvent) => {
    const height = event.nativeEvent.contentSize.height;
    if (height > 0) {
      contentHeight.value = height;
    }
  };

  const onLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height > 0) {
      viewportHeight.value = height;
    }
  };

  const thumbStyle = useAnimatedStyle(() => {
    const isOverflow =
      contentHeight.value > viewportHeight.value + OVERFLOW_EPSILON;

    const trackHeight = Math.max(0, viewportHeight.value - verticalPadding * 2);

    const thumbHeight = isOverflow
      ? Math.min(
          THUMB_MAX_HEIGHT,
          Math.max(
            THUMB_MIN_HEIGHT,
            (viewportHeight.value / contentHeight.value) * trackHeight,
          ),
        )
      : 0;

    const maxScroll = Math.max(1, contentHeight.value - viewportHeight.value);
    const progress = Math.min(1, Math.max(0, offsetY.value / maxScroll));

    const top = isOverflow
      ? verticalPadding + progress * (trackHeight - thumbHeight)
      : verticalPadding;

    return {
      opacity: isOverflow ? 1 : 0,
      top,
      height: thumbHeight,
    };
  });

  return {
    thumbStyle,
    onScroll,
    onContentSizeChange,
    onLayout,
  };
}
