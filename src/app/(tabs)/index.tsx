import { Link, Stack } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

// Stub conversations until the local database (expo-sqlite) is wired up.
const STUB_CONVERSATIONS = [
  { id: '1', title: 'Project discussion' },
  { id: '2', title: 'TypeScript' },
  { id: '3', title: 'Random' },
];

export default function ConversationsScreen() {
  return (
    <View className="flex-1 bg-white p-4 dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Conversations' }} />

      <Link href="/chat/new" asChild>
        <Pressable className="mb-4 rounded-xl bg-blue-600 px-4 py-3 active:bg-blue-700">
          <Text className="text-center font-semibold text-white">New conversation</Text>
        </Pressable>
      </Link>

      <View className="gap-2">
        {STUB_CONVERSATIONS.map((conversation) => (
          <Link
            key={conversation.id}
            href={`/chat/${conversation.id}`}
            asChild
          >
            <Pressable className="rounded-xl border border-neutral-200 px-4 py-3 active:bg-neutral-100 dark:border-neutral-800 dark:active:bg-neutral-900">
              <Text className="text-neutral-900 dark:text-neutral-100">
                {conversation.title}
              </Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </View>
  );
}
