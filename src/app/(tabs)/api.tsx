import { Trash2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { useTemplatesStore } from "@/features/api-templates";
import { apiTemplateFormSchema } from "@/schemas/api-template";
import { showToast } from "@/shared/components/ui/Toast";
import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";

import type { ApiTemplateProvider } from "@/types/api-template";

/** Варианты пресетов провайдеров (baseUrl берется из пресета) */
const PROVIDER_OPTIONS: { id: ApiTemplateProvider; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "openrouter", label: "OpenRouter" },
];

/**
 * Вкладка API: CRUD шаблонов. Форма (имя, пресет OpenAI/OpenRouter,
 * модель вручную, ключ со скрытым вводом) → zod-валидация →
 * репозиторий (ключ в SecureStore) → стор. Ошибки — тост.
 */
export default function ApiScreen() {
  const t = useT();
  const templates = useTemplatesStore((state) => state.templates);
  const loadTemplates = useTemplatesStore((state) => state.loadTemplates);
  const addTemplate = useTemplatesStore((state) => state.addTemplate);
  const deleteTemplate = useTemplatesStore((state) => state.deleteTemplate);

  const [name, setName] = useState("");
  const [provider, setProvider] = useState<ApiTemplateProvider>("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleAdd = async () => {
    const parsed = apiTemplateFormSchema.safeParse({
      name,
      provider,
      model,
      apiKey,
    });

    if (!parsed.success) {
      showToast(t("apiTab.invalidForm"));
      return;
    }

    try {
      await addTemplate(
        parsed.data.name,
        parsed.data.provider,
        parsed.data.model,
        parsed.data.apiKey,
      );

      setName("");
      setModel("");
      setApiKey("");
    } catch (error) {
      console.log("[v0] createTemplate failed:", error);
      // UNIQUE(name) — самый вероятный отказ вставки; остальные ошибки
      // (например, отказ SecureStore) показываем отдельным тостом
      const message = error instanceof Error ? error.message : "";
      showToast(
        message.includes("UNIQUE")
          ? t("apiTab.duplicateName")
          : t("apiTab.saveFailed"),
      );
    }
  };

  const handleDelete = async (templateId: string) => {
    try {
      await deleteTemplate(templateId);
    } catch {
      showToast(t("apiTab.deleteFailed"));
    }
  };

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

      {/* Форма создания шаблона */}
      <View className="mx-4 mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <Text className="pb-1 text-xs uppercase tracking-wide text-text-muted">
          {t("apiTab.name")}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t("apiTab.namePlaceholder")}
          placeholderTextColor={colors.placeholder}
          className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-text-primary"
        />

        <Text className="pb-1 pt-4 text-xs uppercase tracking-wide text-text-muted">
          {t("apiTab.provider")}
        </Text>
        <View className="flex-row gap-2">
          {PROVIDER_OPTIONS.map((option) => {
            const isActive = option.id === provider;

            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: isActive }}
                onPress={() => setProvider(option.id)}
                className={`flex-1 items-center rounded-xl border py-2 ${
                  isActive
                    ? "border-accent bg-accent"
                    : "border-white/10 bg-background"
                }`}
              >
                <Text
                  className={`text-sm ${
                    isActive ? "font-semibold text-white" : "text-text-primary"
                  }`}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text className="pb-1 pt-4 text-xs uppercase tracking-wide text-text-muted">
          {t("apiTab.model")}
        </Text>
        <TextInput
          value={model}
          onChangeText={setModel}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t("apiTab.modelPlaceholder")}
          placeholderTextColor={colors.placeholder}
          className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-text-primary"
        />

        <Text className="pb-1 pt-4 text-xs uppercase tracking-wide text-text-muted">
          {t("apiTab.apiKey")}
        </Text>
        <TextInput
          value={apiKey}
          onChangeText={setApiKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder={t("apiTab.apiKeyPlaceholder")}
          placeholderTextColor={colors.placeholder}
          className="rounded-xl border border-white/10 bg-background px-3 py-2 text-sm text-text-primary"
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("apiTab.add")}
          onPress={() => void handleAdd()}
          className="mt-4 items-center rounded-xl bg-accent py-2.5"
        >
          <Text className="text-sm font-semibold text-white">
            {t("apiTab.add")}
          </Text>
        </Pressable>
      </View>

      {/* Список шаблонов */}
      <View className="mx-4 mt-6">
        <Text className="pb-2 text-sm font-semibold text-text-primary">
          {t("apiTab.listTitle")}
        </Text>

        {templates.length === 0 ? (
          <Text className="text-sm text-text-muted">{t("apiTab.empty")}</Text>
        ) : (
          templates.map((template) => (
            <View
              key={template.id}
              className="mb-2 flex-row items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
            >
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-sm text-text-primary">
                  {template.name}
                </Text>
                <Text numberOfLines={1} className="text-xs text-text-muted">
                  {template.provider} · {template.model}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("apiTab.deleteTemplate")}
                onPress={() => void handleDelete(template.id)}
                className="h-8 w-8 items-center justify-center"
              >
                <Trash2 size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
