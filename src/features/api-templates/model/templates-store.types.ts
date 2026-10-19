import type { ApiTemplate, ApiTemplateProvider } from '@/types/api-template';

export type TemplatesState = {
  templates: ApiTemplate[];
  isLoading: boolean;

  loadTemplates: () => Promise<void>;
  addTemplate: (
    name: string,
    provider: ApiTemplateProvider,
    model: string,
    apiKey: string,
  ) => Promise<ApiTemplate>;
  deleteTemplate: (templateId: string) => Promise<void>;
};
