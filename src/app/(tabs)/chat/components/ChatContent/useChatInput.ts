import { useEffect, useRef, useState } from "react";
import { TextInput } from "react-native";

import { useTemplatesStore } from "@/features/api-templates";
import {
  useChatActions,
  useChatDraft,
  useChatsStore,
  useGenerationStore,
} from "@/features/chats";
import { usePopoverAnchor } from "@/shared/components/ui/PopoverMenu";

import type { ApiTemplate } from "@/types/api-template";

/**
 * Логика поля ввода: выбранный шаблон, доступность отправки,
 * фокус-эффекты и хендлеры (пикер шаблона, отправка).
 * ChatInputArea остается чистым рендером.
 */
export function useChatInput(chatId: string | null) {
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

  const { anchorRef, anchor, measure } = usePopoverAnchor();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  // Выбранный шаблон: у существующего чата — из loadChat,
  // у временного — глобальный «последний используемый»
  const selectedTemplate: ApiTemplate | null =
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

  const handleClosePicker = () => setIsPickerOpen(false);

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

  return {
    draft,
    handleChange,
    inputRef,
    selectedTemplate,
    hasTemplate,
    canSend,
    isPickerOpen,
    anchorRef,
    anchor,
    handleOpenPicker,
    handleClosePicker,
    handleSelectTemplate,
    handleSend,
  };
}
