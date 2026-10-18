import { create } from 'zustand';

import * as templatesRepository from '@/lib/db';

import { useChatsStore } from '@/features/chats/model/chats-store';

import type { TemplatesState } from './templates-store.types';

/**
 * Состояние шаблонов API. Загрузка выполняется при монтировании
 * вкладки API и поля ввода чата (выбор шаблона).
 */
export const useTemplatesStore = create<TemplatesState>((set) => ({
  templates: [],
  isLoading: false,

  loadTemplates: async () => {
    set({ isLoading: true });

    try {
      const templates = await templatesRepository.listTemplates();
      set({ templates, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addTemplate: async (name, provider, model, apiKey) => {
    const template = await templatesRepository.createTemplate(
      name,
      provider,
      model,
      apiKey,
    );

    set((state) => ({ templates: [...state.templates, template] }));

    // Новый шаблон сразу становится «последним используемым»
    // (in-memory состояние chats-store, как drafts)
    useChatsStore.getState().setLastTemplateId(template.id);

    return template;
  },

  deleteTemplate: async (templateId) => {
    await templatesRepository.deleteTemplate(templateId);

    set((state) => ({
      templates: state.templates.filter(
        (template) => template.id !== templateId,
      ),
    }));
  },
}));
