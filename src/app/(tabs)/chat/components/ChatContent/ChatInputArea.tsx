import { KeyRound, Plus } from "lucide-react-native";
import { Pressable, TextInput, View } from "react-native";

import {
  ScrollIndicator,
  useScrollIndicator,
} from "@/shared/components/ui/ScrollIndicator";
import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";

import type { ChatInputAreaProps } from "./ChatInputArea.types";
import { TemplatePickerPopover } from "./TemplatePickerPopover";
import { useChatInput } from "./useChatInput";

/**
 * Поле ввода. Видно всегда — и когда чат выбран, и когда нет
 * (временный чат, chatId = null). Текст = черновик в памяти стора.
 * Логика — в useChatInput, пикер шаблона — TemplatePickerPopover.
 */
export function ChatInputArea({ chatId }: ChatInputAreaProps) {
  const t = useT();
  const scroll = useScrollIndicator({ verticalPadding: 4 });

  const {
    draft,
    handleChange,
    inputRef,
    selectedTemplate,
    hasTemplate,
    canSend,
    isPickerOpen,
    anchorRef,
    anchor,
    rowRef,
    handleRowLayout,
    handleOpenPicker,
    handleClosePicker,
    handleSelectTemplate,
    handleSend,
  } = useChatInput(chatId);

  return (
    <View className="px-4 pb-3">
      <TemplatePickerPopover
        open={isPickerOpen}
        onClose={handleClosePicker}
        anchor={anchor}
        selectedTemplateId={selectedTemplate?.id ?? null}
        onSelect={handleSelectTemplate}
      />

      <View
        ref={rowRef}
        onLayout={handleRowLayout}
        className="flex-row items-center gap-2 rounded-full border border-white/10 bg-white/5 p-2"
      >
        {/* Мини-кнопка выбора шаблона API: без собственной плашки —
            двойной фон ломал левый край капсулы */}
        <Pressable
          ref={anchorRef}
          accessibilityRole="button"
          accessibilityLabel={t("chatInput.chooseTemplate")}
          onPress={handleOpenPicker}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-white/10"
        >
          <KeyRound size={16} color={colors.textMuted} />
        </Pressable>

        <View className="relative min-w-0 flex-1">
          <TextInput
            ref={inputRef}
            value={draft}
            onChangeText={handleChange}
            multiline
            scrollEnabled
            textAlignVertical="center"
            editable={hasTemplate}
            placeholder={
              hasTemplate
                ? t("chatInput.placeholder")
                : t("chatInput.selectTemplate")
            }
            placeholderTextColor={colors.placeholder}
            onScroll={scroll.onScroll}
            onContentSizeChange={scroll.onContentSizeChange}
            onLayout={scroll.onLayout}
            style={{
              paddingTop: 8,
              paddingBottom: 8,
              paddingLeft: 12,
              paddingRight: 8,
              maxHeight: 128,
              minHeight: 36,
            }}
            className="w-full text-sm text-text-primary"
          />
          {/* Индикатор прокрутки слева: видно, сколько текста скрыто */}
          <ScrollIndicator style={scroll.thumbStyle} side="left" inset={1} />
        </View>

        {/* Кнопка отправки: плюсик без шаблона, закрашенный кружок — с шаблоном */}
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={t("chatInput.send")}
          accessibilityState={{ disabled: !canSend }}
          className="h-9 w-9 items-center justify-center rounded-full bg-white/5"
        >
          {hasTemplate ? (
            <View
              className={`h-4 w-4 rounded-full ${
                canSend ? "bg-accent" : "bg-white/20"
              }`}
            />
          ) : (
            <Plus size={16} color={colors.textMuted} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
