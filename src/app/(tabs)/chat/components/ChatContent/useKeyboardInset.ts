import { useEffect, useRef } from 'react';
import { Animated, Keyboard, Platform } from 'react-native';

/**
 * Высота клавиатуры как анимированный отступ снизу.
 *
 * Почему не KeyboardAvoidingView: в edge-to-edge режиме (Expo SDK 53+,
 * Expo Go) Android не ресайзит окно под клавиатуру — behavior там
 * не срабатывает. Поэтому подписываемся на события клавиатуры напрямую:
 * - iOS: keyboardWillShow/WillHide — успеваем за анимацией системы;
 * - Android: keyboardDidShow/DidHide + собственная анимация;
 * - Web: клавиатура — оверлей, перекрытие меряем через visualViewport.
 */
export function useKeyboardInset(): Animated.Value {
  const inset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      const visualViewport = window.visualViewport;
      if (!visualViewport) return undefined;

      const update = () => {
        const overlapped =
          window.innerHeight -
          visualViewport.height -
          visualViewport.offsetTop;

        inset.setValue(Math.max(0, Math.round(overlapped)));
      };

      update();
      visualViewport.addEventListener('resize', update);
      visualViewport.addEventListener('scroll', update);

      return () => {
        visualViewport.removeEventListener('resize', update);
        visualViewport.removeEventListener('scroll', update);
      };
    }

    const isIos = Platform.OS === 'ios';

    const show = Keyboard.addListener(
      isIos ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        Animated.timing(inset, {
          toValue: event.endCoordinates.height,
          duration: isIos ? event.duration || 250 : 200,
          useNativeDriver: false,
        }).start();
      },
    );

    const hide = Keyboard.addListener(
      isIos ? 'keyboardWillHide' : 'keyboardDidHide',
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
  }, [inset]);

  return inset;
}
