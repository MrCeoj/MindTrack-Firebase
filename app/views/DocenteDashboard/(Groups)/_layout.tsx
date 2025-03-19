import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="Index" options={{
        headerShown: false,
      }}/>
      <Stack.Screen name="Group" options={{
        title: 'Grupo',
      }} />
      <Stack.Screen name="Student" options={{
        title: 'Alumno',
      }} />
    </Stack>
  );
}