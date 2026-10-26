import { Pressable, Text, TextInput, View } from "react-native";

import { API_TEMPLATE_PRESETS } from "@/types/api-template";
import { ModelSelect } from "@/shared/components/ModelSelect";
import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";

import { useTemplateForm } from "./useTemplateForm";

/** Форма создания шаблона: имя, пресет провайдера, модель, ключ */
export function TemplateForm() {
  const t = useT();
  const {
    name,
    setName,
    provider,
    setProvider,
    model,
    setModel,
    apiKey,
    setApiKey,
    handleApiKeyBlur,
    handleAdd,
  } = useTemplateForm();

  return (
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
        {Object.values(API_TEMPLATE_PRESETS).map((preset) => {
          const isActive = preset.id === provider;

          return (
            <Pressable
              key={preset.id}
              accessibilityRole="button"
              accessibilityLabel={preset.label}
              accessibilityState={{ selected: isActive }}
              onPress={() => setProvider(preset.id)}
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
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="pb-1 pt-4 text-xs uppercase tracking-wide text-text-muted">
        {t("apiTab.model")}
      </Text>
      <ModelSelect
        baseUrl={API_TEMPLATE_PRESETS[provider].baseUrl}
        provider={provider}
        apiKey={apiKey}
        value={model}
        onChange={setModel}
      />

      <Text className="pb-1 pt-4 text-xs uppercase tracking-wide text-text-muted">
        {t("apiTab.apiKey")}
      </Text>
      <TextInput
        value={apiKey}
        onChangeText={setApiKey}
        onBlur={handleApiKeyBlur}
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
  );
}
