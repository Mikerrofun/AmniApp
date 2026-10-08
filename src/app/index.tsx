import { Redirect } from 'expo-router';

// Корневой роут: после удаления старого index-экрана `/` должен вести
// на первую вкладку (chat — initial route по плану).
export default function IndexRedirect() {
  return <Redirect href="/chat" />;
}
