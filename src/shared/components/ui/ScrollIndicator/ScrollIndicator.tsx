import { View } from 'react-native';

import { THUMB_COLOR, THUMB_WIDTH } from './ScrollIndicator.config';
import type { ScrollIndicatorProps } from './ScrollIndicator.types';

/**
 * Тонкая закругленная полоска-индикатор прокрутки. Рендерится только
 * когда контент не влезает во вьюпорт. Абсолютное позиционирование —
 * размещать внутри relative-контейнера прокручиваемого элемента.
 */
export function ScrollIndicator({
  isVisible,
  thumbHeight,
  thumbTop,
  side = 'right',
  inset = 2,
}: ScrollIndicatorProps) {
  if (!isVisible || thumbHeight <= 0) return null;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        [side]: inset,
        top: thumbTop,
        width: THUMB_WIDTH,
        height: thumbHeight,
        borderRadius: THUMB_WIDTH / 2,
        backgroundColor: THUMB_COLOR,
      }}
    />
  );
}
