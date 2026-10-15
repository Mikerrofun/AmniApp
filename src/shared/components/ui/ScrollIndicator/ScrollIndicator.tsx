import Animated from 'react-native-reanimated';

import { THUMB_COLOR, THUMB_WIDTH } from './ScrollIndicator.config';
import type { ScrollIndicatorProps } from './ScrollIndicator.types';

/**
 * Тонкая закругленная полоска-индикатор прокрутки. Позиция/высота/
 * видимость приходят анимированным стилем из useScrollIndicator
 * (shared values, UI-поток) — компонент не ре-рендерится при скролле.
 * Абсолютное позиционирование — размещать внутри relative-контейнера
 * прокручиваемого элемента.
 */
export function ScrollIndicator({
  style,
  side = 'right',
  inset = 2,
}: ScrollIndicatorProps) {
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          position: 'absolute',
          [side]: inset,
          width: THUMB_WIDTH,
          borderRadius: THUMB_WIDTH / 2,
          backgroundColor: THUMB_COLOR,
        },
        style,
      ]}
    />
  );
}
