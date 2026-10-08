import type { ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";

export interface SwitcherButtonProps {
  optionKey: string;
  isActive: boolean;
  equalWidth?: boolean;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
  children: ReactNode;
}

export interface SwitcherButtonTextProps {
  label: string;
  isActive: boolean;
}
