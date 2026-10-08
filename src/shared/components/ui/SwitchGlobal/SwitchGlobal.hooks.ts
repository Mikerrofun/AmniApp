import { useCallback, useEffect, useRef } from 'react';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

export type SwitchItemLayout = { x: number; width: number; height: number };

const TIMING = { duration: 300, easing: Easing.out(Easing.cubic) };

/**
 * RN-замена DOM-механики веб-версии: вместо рефов и ResizeObserver —
 * карта измерений из `onLayout` ячеек и Reanimated shared values.
 */
export function useSwitchGlobalHook(value: string) {
  const itemLayouts = useRef(new Map<string, SwitchItemLayout>());
  const hasMeasured = useRef(false);

  const left = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);

  const syncIndicator = useCallback(
    (animate: boolean) => {
      const layout = itemLayouts.current.get(value);
      if (!layout) return;

      // Первое измерение — ставим значение сразу, чтобы индикатор
      // не «прилетал» из нуля; дальше — анимируем.
      // Мутация .value — официальный API reanimated shared values;
      // react-hooks/immutability не знает о мутабельных ref-обёртках.
      /* eslint-disable react-hooks/immutability */
      if (!animate || !hasMeasured.current) {
        left.value = layout.x;
        width.value = layout.width;
        height.value = layout.height;
        hasMeasured.current = true;
        return;
      }

      left.value = withTiming(layout.x, TIMING);
      width.value = withTiming(layout.width, TIMING);
      height.value = withTiming(layout.height, TIMING);
      /* eslint-enable react-hooks/immutability */
    },
    [value, left, width, height],
  );

  const onItemLayout = useCallback(
    (key: string, layout: SwitchItemLayout) => {
      itemLayouts.current.set(key, layout);
      syncIndicator(hasMeasured.current);
    },
    [syncIndicator],
  );

  // Пересчёт при смене активной опции.
  useEffect(() => {
    syncIndicator(hasMeasured.current);
  }, [syncIndicator]);

  return { left, width, height, onItemLayout };
}
