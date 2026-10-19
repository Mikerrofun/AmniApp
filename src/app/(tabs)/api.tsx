import { ScrollView, Text } from "react-native";

import { TemplateForm } from "./api/components/TemplateForm";
import { TemplateList } from "./api/components/TemplateList";
import { useT } from "@/shared/i18n";

/**
 * Вкладка API: CRUD шаблонов. Тонкий экран — только заголовки и
 * сборка компонентов; логика в useTemplateForm/useTemplateList.
 */
export default function ApiScreen() {
  const t = useT();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Text className="pt-16 text-center text-2xl text-text-primary">
        {t("apiTab.title")}
      </Text>
      <Text className="pt-2 text-center text-sm text-text-muted">
        {t("apiTab.subtitle")}
      </Text>

      <TemplateForm />
      <TemplateList />
    </ScrollView>
  );
}
