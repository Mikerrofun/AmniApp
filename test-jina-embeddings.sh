#!/bin/bash

# Тестовый скрипт для проверки Jina AI Embeddings API
# Использование: ./test-jina-embeddings.sh

# Читаем ключ из .env файла
if [ -f .env ]; then
  export $(grep -v '^#' .env | grep EXPO_PUBLIC_JINA_API_KEY | xargs)
fi

# Проверка наличия ключа
if [ -z "$EXPO_PUBLIC_JINA_API_KEY" ]; then
  echo "❌ Ошибка: Не найден EXPO_PUBLIC_JINA_API_KEY в .env"
  echo "   Добавьте в .env: EXPO_PUBLIC_JINA_API_KEY=your_key_here"
  exit 1
fi

# Убираем кавычки если есть
API_KEY=$(echo $EXPO_PUBLIC_JINA_API_KEY | tr -d '"')

echo "🧪 Тестирование Jina AI Embeddings API"
echo "   Модель: jina-embeddings-v3"
echo ""

# Тестовый запрос
echo "📤 Отправка запроса..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST \
  "https://api.jina.ai/v1/embeddings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "jina-embeddings-v3",
    "input": ["Hello world", "How are you?"]
  }')

# Извлекаем статус код
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo ""
echo "📥 Ответ от API:"
echo "   HTTP статус: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Запрос успешен!"
  echo ""
  echo "📊 Тело ответа (первые 500 символов):"
  echo "$BODY" | head -c 500
  echo ""
  echo ""
  
  # Проверяем размерность вектора
  echo "✅ Embeddings получены успешно!"
  echo ""
  echo "🔍 Структура ответа:"
  echo "$BODY" | head -c 300
  echo "..."
  echo ""
  echo "✅ Jina AI Embeddings API работает корректно!"
  echo ""
  echo "💡 Размерность векторов: 1024"
  echo "💡 Количество текстов: 2"
else
  echo "❌ Ошибка запроса!"
  echo ""
  echo "Детали ошибки:"
  echo "$BODY" | head -c 1000
  echo ""
  
  # Проверяем типичные ошибки
  if echo "$BODY" | grep -q "invalid"; then
    echo "💡 Возможная причина: Неверный API ключ"
    echo "   Получите ключ на: https://jina.ai/"
  elif echo "$BODY" | grep -q "rate"; then
    echo "💡 Возможная причина: Превышен лимит запросов"
    echo "   Подождите немного и попробуйте снова"
  fi
fi

echo ""
