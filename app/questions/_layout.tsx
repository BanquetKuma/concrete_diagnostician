// Questions section layout with Stack navigation
// Hides native header since screens have custom headers

import { Stack } from 'expo-router';

export default function QuestionsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
