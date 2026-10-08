import { Pressable } from "react-native";

import { cn } from "@/shared/lib/cn";
import { SwitcherButtonProps } from "../SwitcherButton/SwitcherButton.types";

/**
 * Кнопка переключателя с поддержкой accessibility
 */
export function SwitcherButton({
  optionKey,
  isActive,
  equalWidth = true,
  onPress,
  onLayout,
  children,
}: SwitcherButtonProps) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      aria-selected={isActive}
      accessibilityLabel={optionKey}
      onPress={onPress}
      onLayout={onLayout}
      className={cn(equalWidth && "flex-1", "items-center justify-center")}
    >
      {children}
    </Pressable>
  );
}
