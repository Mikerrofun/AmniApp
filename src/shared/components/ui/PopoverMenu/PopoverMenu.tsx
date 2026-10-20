import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  ScrollIndicator,
  useScrollIndicator,
} from '@/shared/components/ui/ScrollIndicator';
import { colors } from '@/shared/config/colors';

import { POPOVER_DEFAULT_WIDTH, usePopoverPosition } from './PopoverMenu.hooks';
import type { PopoverMenuProps } from './PopoverMenu.types';

/**
 * Якорный popover: маленькое меню, открывающееся рядом с элементом-якорем.
 * Рендерится в transparent Modal, поэтому всегда поверх overlay-сайдбара.
 * Закрытие: тап вне popover'а (все платформы), уход курсора (web),
 * кнопка назад (Android).
 *
 * С maxHeight контент выше лимита скроллится, справа — ScrollIndicator.
 * Для top-placement высота измеряется onLayout'ом: первый кадр рендерится
 * с opacity 0 по оценке maxHeight, затем позиция уточняется.
 */
export function PopoverMenu({
  open,
  onClose,
  anchor,
  placement = 'bottom-end',
  width = POPOVER_DEFAULT_WIDTH,
  maxHeight,
  children,
}: PopoverMenuProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Измерение хранится вместе с флагом открытия: при смене open высота
  // считается невалидной без эффекта (якорь и контент могут меняться)
  const [measurement, setMeasurement] = useState<{
    open: boolean;
    height: number;
  } | null>(null);
  const contentHeight =
    measurement && measurement.open === open ? measurement.height : null;
  const scroll = useScrollIndicator({ verticalPadding: 4 });

  const position = usePopoverPosition(
    anchor,
    width,
    placement,
    windowWidth,
    windowHeight,
    contentHeight,
    maxHeight ?? null,
  );

  if (!open || !position) return null;

  const isMeasured = placement !== 'top-end' || contentHeight !== null;

  return (
    <Modal
      transparent
      visible
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Слой-перехватчик: тап вне popover закрывает его */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessible={false}
      >
        {/* Контейнер popover'а: Pressable, т.к. hover-события
            (закрытие по уходу курсора на web) есть только на Pressable */}
        <Pressable
          collapsable={false}
          /* Перехватываем начало касания, чтобы тап по телу popover
             не проваливался в закрывающий слой */
          onStartShouldSetResponder={() => true}
          /* Web: закрытие, когда курсор ушел с popover'а */
          onHoverOut={Platform.OS === 'web' ? onClose : undefined}
          style={[
            styles.popover,
            {
              left: position.left,
              top: position.top,
              width,
              opacity: isMeasured ? 1 : 0,
            },
          ]}
        >
          <View
            collapsable={false}
            onLayout={(event) => {
              const height = event.nativeEvent.layout.height;
              setMeasurement((prev) =>
                prev && prev.open === open && prev.height === height
                  ? prev
                  : { open, height },
              );
            }}
            style={maxHeight != null ? { maxHeight } : undefined}
          >
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={scroll.onScroll}
              onContentSizeChange={(contentWidth, contentHeight) =>
                scroll.onContentSizeChange({
                  nativeEvent: {
                    contentSize: { width: contentWidth, height: contentHeight },
                  },
                })
              }
            >
              {children}
            </ScrollView>
            <ScrollIndicator style={scroll.thumbStyle} side="right" inset={2} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  popover: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.card,
    paddingVertical: 4,
  },
});
