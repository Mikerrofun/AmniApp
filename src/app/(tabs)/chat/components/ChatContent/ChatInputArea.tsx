import { Check, KeyRound, Plus } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { useTemplatesStore } from "@/features/api-templates";
import {
  useChatActions,
  useChatDraft,
  useChatsStore,
  useGenerationStore,
} from "@/features/chats";
import {
  PopoverMenu,
  usePopoverAnchor,
} from "@/shared/components/ui/PopoverMenu";
import {
  ScrollIndicator,
  useScrollIndicator,
} from "@/shared/components/ui/ScrollIndicator";
import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";

import type { ChatInputAreaProps } from "./ChatInputArea.types";

const TEMPLATE_POPOVER_WIDTH = 240;

/**
 * Поле ввода. Видно всегда — и когда чат выбран, и когда нет
 * (временный чат, chatId = null). Текст = черновик в памяти стора.
 */
export function ChatInputArea({ chatId }: ChatInputAreaProps) {
  const t = useT();
  const { draft, handleChange } = useChatDraft(chatId);
  const { sendMessage } = useChatActions();

  const templates = useTemplatesStore((state) => state.templates);
  const loadTemplates = useTemplatesStore((state) => state.loadTemplates);
  const activeTemplate = useChatsStore((state) => state.activeTemplate);
  const lastTemplateId = useChatsStore((state) => state.lastTemplateId);
  const setChatTemplate = useChatsStore((state) => state.setChatTemplate);
  const setLastTemplateId = useChatsStore((state) => state.setLastTemplateId);
  const generationStatus = useGenerationStore((state) => state.status);

  const inputRef = useRef<TextInput>(null);
  const focusChatId = useChatsStore((state) => state.focusChatId);
  const consumeFocusChat = useChatsStore((state) => state.consumeFocusChat);
  const focusInputToken = useChatsStore((state) => state.focusInputToken);
  const lastFocusTokenRef = useRef(focusInputToken);

  const scroll = useScrollIndicator({ verticalPadding: 4 });

  const { anchorRef, anchor, measure } = usePopoverAnchor();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const selectedTemplate =
    chatId !== null
      ? activeTemplate
      : (templates.find((tpl) => tpl.id === lastTemplateId) ?? null);
  const hasTemplate = selectedTemplate !== null;
  const isStreaming = generationStatus === "streaming";
  const canSend = hasTemplate && draft.trim() !== "" && !isStreaming;

  useEffect(() => {
    if (chatId !== null && focusChatId === chatId) {
      consumeFocusChat(chatId);
      inputRef.current?.focus();
    }
  }, [focusChatId, chatId, consumeFocusChat]);

  // Фокус поля временного чата
  useEffect(() => {
    if (focusInputToken === lastFocusTokenRef.current) return;

    lastFocusTokenRef.current = focusInputToken;
    inputRef.current?.focus();
  }, [focusInputToken]);

  const handleOpenPicker = () => {
    measure();
    setIsPickerOpen(true);
  };

  const handleSelectTemplate = (templateId: string) => {
    setIsPickerOpen(false);

    if (chatId === null) {
      // Во временном чате выбор = «последний используемый»
      setLastTemplateId(templateId);
    } else {
      void setChatTemplate(chatId, templateId);
    }
  };

  const handleSend = () => {
    if (!canSend) return;

    void sendMessage(chatId, draft);
  };

  return (
    <View className="px-4 pb-3">
      <PopoverMenu
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        anchor={anchor}
        width={TEMPLATE_POPOVER_WIDTH}
      >
        {templates.length === 0 ? (
          <Text className="px-3 py-2 text-sm text-text-muted">
            {t("chatInput.noTemplates")}
          </Text>
        ) : (
          templates.map((template) => {
            const isSelected = template.id === selectedTemplate?.id;

            return (
              <Pressable
                key={template.id}
                accessibilityRole="button"
                accessibilityLabel={t("chatInput.chooseTemplate")}
                onPress={() => handleSelectTemplate(template.id)}
                className="flex-row items-center gap-2 px-3 py-2"
              >
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-sm text-text-primary">
                    {template.name}
                  </Text>
                  <Text numberOfLines={1} className="text-xs text-text-muted">
                    {template.model}
                  </Text>
                </View>
                {isSelected && <Check size={14} color={colors.accent} />}
              </Pressable>
            );
          })
        )}
      </PopoverMenu>

      <View className="flex-row items-center gap-2 rounded-3xl border border-white/10 bg-white/5 p-2">
        {/* Мини-кнопка выбора шаблона API */}
        <View className="h-9 w-9 items-center justify-center rounded-full bg-white/5">
          <Pressable
            ref={anchorRef}
            accessibilityRole="button"
            accessibilityLabel={t("chatInput.chooseTemplate")}
            onPress={handleOpenPicker}
            className="h-full w-full items-center justify-center"
          >
            <KeyRound size={16} color={colors.textMuted} />
          </Pressable>
        </View>

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
