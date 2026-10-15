"use no memo";

import { useEffect, useState, type RefObject } from "react";
import {
  Animated,
  Dimensions,
  Keyboard,
  Platform,
  type View,
} from "react-native";

/** Зазор между полем ввода и клавиатурой, px */
const KEYBOARD_GAP = 8;

/**
 * Подъем контента над клавиатурой как анимированный отступ снизу.
 *
 * Подъем считается точно: меряем фактическое перекрытие целевого
 * элемента (поле ввода) клавиатурой, а не берем полную высоту
 * клавиатуры — полная высота поднимает контент слишком высоко над
 * зоной, которую клавиатура не перекрывает (таб-бар, safe area).
 */
export function useKeyboardInset(
  targetRef?: RefObject<View | null>,
): Animated.Value {
  // Стабильный инстанс через useState (а не useRef): компилятор React
  // запрещает доступ к ref во время рендера, а значение нужно вернуть
  const [inset] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (Platform.OS === "web") {
      const visualViewport = window.visualViewport;
      if (!visualViewport) return undefined;

      const update = () => {
        const overlapped =
          window.innerHeight - visualViewport.height - visualViewport.offsetTop;

        inset.setValue(Math.max(0, Math.round(overlapped)));
      };

      update();
      visualViewport.addEventListener("resize", update);
      visualViewport.addEventListener("scroll", update);

      return () => {
        visualViewport.removeEventListener("resize", update);
        visualViewport.removeEventListener("scroll", update);
      };
    }

    const isIos = Platform.OS === "ios";

    const show = Keyboard.addListener(
      isIos ? "keyboardWillShow" : "keyboardDidShow",
      (event) => {
        const keyboardHeight = event.endCoordinates.height;
        const duration = isIos ? event.duration || 250 : 200;

        const animate = (toValue: number) =>
          Animated.timing(inset, {
            toValue,
            duration,
            useNativeDriver: false,
          }).start();

        const target = targetRef?.current;
        if (!target) {
          animate(keyboardHeight);
          return;
        }

        // Перекрытие = нижний край элемента минус верхний край клавиатуры
        target.measureInWindow((_x, y, _width, height) => {
          const windowHeight = Dimensions.get("window").height;
          const keyboardTop = windowHeight - keyboardHeight;
          animate(Math.max(0, y + height - keyboardTop + KEYBOARD_GAP));
        });
      },
    );

    const hide = Keyboard.addListener(
      isIos ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        Animated.timing(inset, {
          toValue: 0,
          duration: isIos ? 250 : 200,
          useNativeDriver: false,
        }).start();
      },
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, [inset, targetRef]);

  return inset;
}
