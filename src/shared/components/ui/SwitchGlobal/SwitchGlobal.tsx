import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { SwitcherButton } from "@/shared/components/ui/SwitcherButton";
import { cn } from "@/shared/lib/cn";

import { useSwitchGlobalHook } from "./SwitchGlobal.hooks";
import type { SwitchGlobalProps } from "./SwitchGlobal.types";

export function SwitchGlobal({
  options,
  value,
  onChange,
  equalWidth = true,
  className,
  sliderClassName,
}: SwitchGlobalProps) {
  const { left, width, height, onItemLayout } = useSwitchGlobalHook(value);

  const indicatorStyle = useAnimatedStyle(() => ({
    left: left.value,
    width: width.value,
    height: height.value,
  }));

  if (options.length === 0) return null;

  return (
    <View
      accessibilityRole="tablist"
      className={cn(
        "relative flex-row items-center overflow-hidden rounded-xl",
        equalWidth ? "w-full" : "self-start",
        className,
      )}
    >
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", top: 0 }, indicatorStyle]}
      >
        <View
          className={cn("h-full w-full rounded-xl bg-accent", sliderClassName)}
        />
      </Animated.View>
      {options.map((option) => {
        const isActive = option.key === value;
        return (
          <SwitcherButton
            key={option.key}
            optionKey={option.key}
            isActive={isActive}
            equalWidth={equalWidth}
            onPress={() => {
              if (!isActive) onChange?.(option.key);
            }}
            onLayout={(event) =>
              onItemLayout(option.key, event.nativeEvent.layout)
            }
          >
            {option.component}
          </SwitcherButton>
        );
      })}
    </View>
  );
}
