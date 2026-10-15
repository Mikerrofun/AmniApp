import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

import { useToastStore } from "./toast-store";

const AUTO_HIDE_MS = 1500;

export function Toast() {
  const message = useToastStore((state) => state.message);
  const toastKey = useToastStore((state) => state.toastKey);
  const clear = useToastStore((state) => state.clear);

  useEffect(() => {
    if (message === null) return;

    const timer = setTimeout(clear, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [message, toastKey, clear]);

  if (message === null) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={styles.overlay}
      className="items-center justify-center"
    >
      <Animated.View
        key={toastKey}
        entering={FadeInDown.duration(180)}
        exiting={FadeOut.duration(150)}
        className="rounded-xl bg-neutral-800/95 px-4 py-2.5"
      >
        <Text className="text-sm text-white">{message}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
});
