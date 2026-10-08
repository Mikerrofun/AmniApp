import { Text } from "react-native";

import { cn } from "@/shared/lib/cn";
import { SwitcherButtonTextProps } from "../SwitcherButton/SwitcherButton.types";

export function SwitcherButtonText({
  label,
  isActive,
}: SwitcherButtonTextProps) {
  return (
    <Text
      className={cn(
        "py-3 text-base",
        isActive ? "text-text-primary" : "text-text-muted",
      )}
    >
      {label}
    </Text>
  );
}
