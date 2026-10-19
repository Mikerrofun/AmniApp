import { useCallback, useEffect } from "react";

import { useTemplatesStore } from "@/features/api-templates";
import { showToast } from "@/shared/components/ui/Toast";
import { useT } from "@/shared/i18n";

/**
 * Список шаблонов: загрузка при монтировании и удаление.
 * Вся логика — здесь, компонент только рендерит.
 */
export function useTemplateList() {
  const t = useT();
  const templates = useTemplatesStore((state) => state.templates);
  const loadTemplates = useTemplatesStore((state) => state.loadTemplates);
  const deleteTemplate = useTemplatesStore((state) => state.deleteTemplate);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleDelete = useCallback(
    async (templateId: string) => {
      try {
        await deleteTemplate(templateId);
      } catch {
        showToast(t("apiTab.deleteFailed"));
      }
    },
    [t, deleteTemplate],
  );

  return { templates, handleDelete };
}
