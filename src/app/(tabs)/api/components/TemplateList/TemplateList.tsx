import { Trash2 } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import Animated, {
  FadeInUp,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";

import { API_TAB_ANIMATION } from "../api-tab.animation";
import { useTemplateList } from "./useTemplateList";

/** Список шаблонов с кнопкой удаления у каждого */
export function TemplateList() {
  const t = useT();
  const { templates, handleDelete } = useTemplateList();

  return (
    <View className="mx-4 mt-6">
      <Text className="pb-2 text-sm font-semibold text-text-primary">
        {t("apiTab.listTitle")}
      </Text>

      {templates.length === 0 ? (
        <Text className="text-sm text-text-muted">{t("apiTab.empty")}</Text>
      ) : (
        templates.map((template) => (
          <Animated.View
            key={template.id}
            layout={LinearTransition.duration(API_TAB_ANIMATION.listLayout)}
            entering={FadeInUp.duration(API_TAB_ANIMATION.listEnter)}
            exiting={FadeOut.duration(API_TAB_ANIMATION.listExit)}
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
          </Animated.View>
        ))
      )}
    </View>
  );
}
