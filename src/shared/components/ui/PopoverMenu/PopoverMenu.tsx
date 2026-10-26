import { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import {
  ScrollIndicator,
  useScrollIndicator,
} from "@/shared/components/ui/ScrollIndicator";
import { colors } from "@/shared/config/colors";

import { POPOVER_DEFAULT_WIDTH, usePopoverPosition } from "./PopoverMenu.hooks";
import type { PopoverMenuProps } from "./PopoverMenu.types";

/**
 * Якорный popover: маленькое меню, открывающееся рядом с элементом-якорем.
 * Рендерится в transparent Modal, поэтому всегда поверх overlay-сайдбара.
 */
export function PopoverMenu({ open, ...content }: PopoverMenuProps) {
  if (!open) return null;
  return <PopoverMenuContent {...content} />;
}

function PopoverMenuContent({
  onClose,
  anchor,
  placement = "bottom-end",
  width = POPOVER_DEFAULT_WIDTH,
  maxHeight,
  children,
}: Omit<PopoverMenuProps, "open">) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const scroll = useScrollIndicator({ verticalPadding: 4 });

  const position = usePopoverPosition(
    anchor,
    width,
    placement,
    windowWidth,
    windowHeight,
    measuredHeight,
    maxHeight ?? null,
  );

  if (!position) return null;

  const isMeasured = placement !== "top-end" || measuredHeight !== null;

  return (
    <Modal
      transparent
      visible
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessible={false}
      >
        <Pressable
          collapsable={false}
          onStartShouldSetResponder={() => true}
          onHoverOut={Platform.OS === "web" ? onClose : undefined}
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
              setMeasuredHeight((prev) => (prev === height ? prev : height));
            }}
            style={maxHeight != null ? { maxHeight } : undefined}
          >
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              // В поповерах бывают инпуты (поиск моделей): тап по строке
              // при открытой клавиатуре должен срабатывать с первого раза
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onLayout={scroll.onLayout}
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
            <ScrollIndicator style={scroll.thumbStyle} side="right" inset={3} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  popover: {
    position: "absolute",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.card,
    paddingVertical: 4,
  },
});
