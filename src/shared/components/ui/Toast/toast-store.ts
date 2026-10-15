import { create } from "zustand";

type ToastState = {
  /** Активный текст тоста, null — тост скрыт */
  message: string | null;
  /**
   * Инкрементится при каждом show: ключ для перезапуска анимации,
   * даже если текст повторяется подряд
   */
  toastKey: number;
  show: (message: string) => void;
  clear: () => void;
};

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  toastKey: 0,
  show: (message) =>
    set((state) => ({ message, toastKey: state.toastKey + 1 })),
  clear: () => set({ message: null }),
}));

/**
 * Триггер тоста: показывает текст поверх экрана на пару секунд.
 * Вызывается откуда угодно (хуки, обработчики) без проброса пропсов.
 */
export const showToast = (message: string) =>
  useToastStore.getState().show(message);
