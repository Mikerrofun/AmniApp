import { Redirect, usePathname } from "expo-router";

/**
 * Компонент-обработчик редиректов для корневых маршрутов
 * Работает как middleware для перенаправления с базовых путей
 */
export function RedirectHandler() {
  const pathname = usePathname();

  if (pathname === "/") {
    return <Redirect href="/chat" />;
  }

  return null;
}
