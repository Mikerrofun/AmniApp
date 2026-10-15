import { useCallback } from "react";
import type { LayoutChangeEvent, NativeSyntheticEvent } from "react-native";
import { useAnimatedStyle, useSharedValue } from "react-native-reanimated";

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
 * Математика тонкого индикатора прокрутки на reanimated shared values:
 * смещение/размеры живут вне React-состояния, позиция тумбы считается
 * в worklet'е на UI-потоке. Скролл не вызывает ни одного ре-рендера —
 * индикатор движется синхронно с прокруткой без рывков.
 *
 * Подписка — обычный onScroll (работает одинаково для SectionList,
 * FlatList и TextInput, которым reanimated-обработчик не передать):
 * колбэк пишет в shared value из JS-потока, отрисовка тумбы идет
 * на UI-потоке. Колбэки намеренно не мемоизированы: компонент больше
 * не ре-рендерится при скролле, пересоздавать нечего.
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

  // Сброс при пересоздании списка (смена сортировки/фильтра, поиск):
  // список перемонтируется и встает наверх БЕЗ scroll-события, поэтому
  // stale offsetY никогда не исправится сам — тумба прыгала вниз и
  // дергалась обратно. Сбрасываем и контент, чтобы до прихода нового
  // contentSize тумба не мигала в неправильной позиции.
  // Shared values reanimated стабильны между рендерами — пустые deps
  // корректны; в deps их нельзя: react-hooks/immutability запрещает
  // мутировать «реактивные» значения внутри колбэка
  const resetScroll = useCallback(() => {
    offsetY.value = 0;
    contentHeight.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const thumbStyle = useAnimatedStyle(() => {
    const isOverflow =
      contentHeight.value > viewportHeight.value + OVERFLOW_EPSILON;

    // Уменьшаем рабочую высоту на отступы сверху и снизу
    const trackHeight = Math.max(
      0,
      viewportHeight.value - verticalPadding * 2,
    );

    const thumbHeight = isOverflow
      ? Math.max(
          THUMB_MIN_HEIGHT,
          (viewportHeight.value / contentHeight.value) * trackHeight,
        )
      : 0;

    const maxScroll = Math.max(1, contentHeight.value - viewportHeight.value);
    const progress = Math.min(1, Math.max(0, offsetY.value / maxScroll));

    // top учитывает верхний отступ и ограничивает движение
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
    resetScroll,
  };
}
