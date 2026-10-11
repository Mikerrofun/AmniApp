const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// expo-sqlite на web: WASM-модуль wa-sqlite резолвится как ассет
config.resolver.assetExts.push("wasm");

// Игнорируем expo-sqlite/web/worker.ts чтобы избежать ошибки сериализации
// Это временное решение, пока не будет исправлено в expo-sqlite
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Пропускаем worker.ts файл expo-sqlite на web
  if (
    platform === "web" &&
    moduleName.includes("expo-sqlite") &&
    moduleName.includes("worker.ts")
  ) {
    return {
      type: "empty",
    };
  }

  // Используем стандартный резолвер для всего остального
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
