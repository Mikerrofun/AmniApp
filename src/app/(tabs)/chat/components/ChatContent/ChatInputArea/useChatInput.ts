import { useCallback, useEffect, useRef, useState } from "react";
import { TextInput, type View } from "react-native";

import { useTemplatesStore } from "@/features/api-templates";
import {
  useChatActions,
  useChatDraft,
  useChatsStore,
  useGenerationStore,
} from "@/features/chats";
import { usePopoverAnchor } from "@/shared/components/ui/PopoverMenu";

import type { ApiTemplate } from "@/types/api-template";

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
  const pendingUserText = useGenerationStore((state) => state.pendingUserText);

  const inputRef = useRef<TextInput>(null);
  const focusChatId = useChatsStore((state) => state.focusChatId);
  const consumeFocusChat = useChatsStore((state) => state.consumeFocusChat);
  const focusInputToken = useChatsStore((state) => state.focusInputToken);
  const lastFocusTokenRef = useRef(focusInputToken);

  const { anchorRef, anchor, setAnchor } = usePopoverAnchor();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const rowRef = useRef<View>(null);
  const restingBottomRef = useRef<number | null>(null);

  const handleRowLayout = useCallback(() => {
    rowRef.current?.measureInWindow((_x, y, _width, height) => {
      const bottom = y + height;
      const resting = restingBottomRef.current;

      if (resting === null || bottom > resting) {
        restingBottomRef.current = bottom;
      }
    });
  }, []);

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
  // Блокируем отправку и на стриминге, и в оптимистичной фазе до него
  const isStreaming =
    generationStatus === "streaming" || pendingUserText !== null;
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
    rowRef.current?.measureInWindow((_x, rowY, _width, rowHeight) => {
      const resting = restingBottomRef.current;
      // Насколько клавиатура подняла строку относительно «покоя»
      const raisedInset =
        resting === null ? 0 : Math.max(0, resting - (rowY + rowHeight));

      anchorRef.current?.measureInWindow((x, y, width, height) => {
        // Поповер статичен, как модалка: позиция считается сразу для
        // «покоя» строки. Если клавиатура открыта — роняем ее, строка
        // опустится под уже открытый поповер
        setAnchor({ x, y: y + raisedInset, width, height });

        if (raisedInset > 1) {
          inputRef.current?.blur();
        }

        setIsPickerOpen(true);
      });
    });
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
    rowRef,
    handleRowLayout,
    handleOpenPicker,
    handleClosePicker,
    handleSelectTemplate,
    handleSend,
  };
}
