import { Check } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { useTemplatesStore } from "@/features/api-templates";
import { PopoverMenu } from "@/shared/components/ui/PopoverMenu";
import { colors } from "@/shared/config/colors";
import { useT } from "@/shared/i18n";

import type { PopoverAnchor } from "@/shared/components/ui/PopoverMenu";

const TEMPLATE_POPOVER_WIDTH = 240;

const TEMPLATE_POPOVER_MAX_HEIGHT = 224;

export type TemplatePickerPopoverProps = {
  open: boolean;
  onClose: () => void;
  /** Координаты якоря (кнопка-ключ) в окне */
  anchor: PopoverAnchor | null;
  /** id выбранного шаблона — для галочки в списке */
  selectedTemplateId: string | null;
  onSelect: (templateId: string) => void;
};

export function TemplatePickerPopover({
  open,
  onClose,
  anchor,
  selectedTemplateId,
  onSelect,
}: TemplatePickerPopoverProps) {
  const t = useT();
  const templates = useTemplatesStore((state) => state.templates);

  return (
    <PopoverMenu
      open={open}
      onClose={onClose}
      anchor={anchor}
      placement="top-end"
      width={TEMPLATE_POPOVER_WIDTH}
      maxHeight={TEMPLATE_POPOVER_MAX_HEIGHT}
    >
      {templates.length === 0 ? (
        <Text className="px-3 py-2 text-sm text-text-muted">
          {t("chatInput.noTemplates")}
        </Text>
      ) : (
        templates.map((template) => {
          const isSelected = template.id === selectedTemplateId;

          return (
            <Pressable
              key={template.id}
              accessibilityRole="button"
              accessibilityLabel={t("chatInput.chooseTemplate")}
              onPress={() => onSelect(template.id)}
              className="flex-row items-center gap-2 px-3 py-2"
            >
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="text-sm text-text-primary">
                  {template.name}
                </Text>
                <Text numberOfLines={1} className="text-xs text-text-muted">
                  {template.model}
                </Text>
              </View>
              {isSelected && <Check size={14} color={colors.accent} />}
            </Pressable>
          );
        })
      )}
    </PopoverMenu>
  );
}
