import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';

import { colors } from '@/shared/config/colors';

import { POPOVER_DEFAULT_WIDTH, usePopoverPosition } from './PopoverMenu.hooks';
import type { PopoverMenuProps } from './PopoverMenu.types';

/**
 * Якорный popover: маленькое меню, открывающееся рядом с элементом-якорем.
 * Рендерится в transparent Modal, поэтому всегда поверх overlay-сайдбара.
 * Закрытие: тап вне popover'а (все платформы), уход курсора (web),
 * кнопка назад (Android).
 */
export function PopoverMenu({
  open,
  onClose,
  anchor,
  placement = 'bottom-end',
  width = POPOVER_DEFAULT_WIDTH,
  children,
}: PopoverMenuProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const position = usePopoverPosition(
    anchor,
    width,
    placement,
    windowWidth,
    windowHeight,
  );

  if (!open || !position) return null;

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
            { left: position.left, top: position.top, width },
          ]}
        >
          {children}
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
