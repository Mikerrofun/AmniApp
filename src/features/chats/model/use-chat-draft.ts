import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatRecord } from "@/types/chat";

import { useChatsStore } from "./chats-store";

const DRAFT_SAVE_DEBOUNCE_MS = 300;

export function useChatDraft(chat: ChatRecord) {
  const updateDraft = useChatsStore((state) => state.updateDraft);

  const [draft, setDraft] = useState(chat.draft ?? "");

  // Зеркало черновика для чтения вне рендера (flush по onBlur/unmount)
  const draftRef = useRef(chat.draft ?? "");

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    void updateDraft(chat.id, draftRef.current);
  }, [chat.id, updateDraft]);

  const handleChange = useCallback(
    (text: string) => {
      draftRef.current = text;
      setDraft(text);

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void updateDraft(chat.id, text);
      }, DRAFT_SAVE_DEBOUNCE_MS);
    },
    [chat.id, updateDraft],
  );

  // Сброс отложенной записи при размонтировании (смена чата / уход с экрана)
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return { draft, handleChange, flush };
}
