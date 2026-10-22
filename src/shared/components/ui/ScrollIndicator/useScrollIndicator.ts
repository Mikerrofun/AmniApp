import type { LayoutChangeEvent, NativeSyntheticEvent } from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import {
  OVERFLOW_EPSILON,
  THUMB_FADE_IN_DURATION,
  THUMB_FADE_OUT_DURATION,
  THUMB_HIDE_DELAY,
  THUMB_MAX_HEIGHT,
  THUMB_MIN_HEIGHT,
  THUMB_SMOOTHING_DURATION,
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
  // 0 — тумба скрыта (прокрутка неактивна), 1 — видна
  const visibility = useSharedValue(0);

  const onScroll = (event: NativeSyntheticEvent<ScrollMetrics>) => {
    offsetY.value = event.nativeEvent.contentOffset.y;

    // Для TextInput contentSize может приходить в onScroll
    const height = event.nativeEvent.contentSize?.height;
    if (height != null && height > 0) {
      contentHeight.value = height;
    }

    // Тумба живет только пока прокрутка активна: fade-in по событию,
    // пауза, fade-out; каждое новое событие перезапускает цепочку
    visibility.value = withSequence(
      withTiming(1, { duration: THUMB_FADE_IN_DURATION }),
      withDelay(
        THUMB_HIDE_DELAY,
        withTiming(0, { duration: THUMB_FADE_OUT_DURATION }),
      ),
    );
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

    // Позиция/высота плавно догоняют скролл (иначе тумба «дергается»).
    // Opacity — напрямую из visibility: его анимирует withSequence в
    // onScroll, лишний withTiming здесь добавлял вторую задержку, и
    // тумба появлялась заметно позже начала прокрутки
    return {
      opacity: isOverflow ? visibility.value : 0,
      top: withTiming(top, { duration: THUMB_SMOOTHING_DURATION }),
      height: withTiming(thumbHeight, { duration: THUMB_SMOOTHING_DURATION }),
    };
  });

  return {
    thumbStyle,
    onScroll,
    onContentSizeChange,
    onLayout,
  };
}
