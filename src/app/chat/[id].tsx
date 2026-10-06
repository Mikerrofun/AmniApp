import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

// Stub chat screen: local state only, streaming and persistence come next.
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');

  const send = () => {
    const content = draft.trim();
    if (!content) return;
    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()), role: 'user', content },
    ]);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-neutral-950"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: `Chat ${id}` }} />

      <ScrollView className="flex-1 p-4" contentContainerClassName="gap-2">
        {messages.length === 0 && (
          <Text className="text-neutral-500 dark:text-neutral-400">
            No messages yet.
          </Text>
        )}
        {messages.map((message) => (
          <View
            key={message.id}
            className={
              message.role === 'user'
                ? 'self-end rounded-2xl bg-blue-600 px-4 py-2'
                : 'self-start rounded-2xl bg-neutral-200 px-4 py-2 dark:bg-neutral-800'
            }
          >
            <Text
              className={
                message.role === 'user'
                  ? 'text-white'
                  : 'text-neutral-900 dark:text-neutral-100'
              }
            >
              {message.content}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View className="flex-row items-center gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
        <TextInput
          className="flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
          placeholder="Message..."
          placeholderTextColor="#9ca3af"
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable
          className="rounded-xl bg-blue-600 px-4 py-2 active:bg-blue-700"
          onPress={send}
        >
          <Text className="font-semibold text-white">↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
