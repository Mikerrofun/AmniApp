import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * На web мобильная клавиатура — оверлей: layout viewport не ресайзится,
 * поэтому перекрытие меряем через visualViewport и отдаем как отступ.
 * На нативе всегда 0 — там клавиатуру обрабатывает KeyboardAvoidingView.
 */
export function useWebKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    const visualViewport = window.visualViewport;
    if (!visualViewport) return undefined;

    const update = () => {
      const overlapped =
        window.innerHeight -
        visualViewport.height -
        visualViewport.offsetTop;

      setInset(Math.max(0, Math.round(overlapped)));
    };

    update();
    visualViewport.addEventListener('resize', update);
    visualViewport.addEventListener('scroll', update);

    return () => {
      visualViewport.removeEventListener('resize', update);
      visualViewport.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
