import { Stack } from "expo-router";

export default function auth_layout() {
  return (
    <Stack>
      <Stack.Screen name="Login" options={{ headerShown: false }} />
      <Stack.Screen
        name="Register"
        options={{
          title: "",
          headerStyle: { backgroundColor: "#2F031A" },
          headerTintColor: "#fff",
          headerTransparent: true,
          headerTitleStyle: { fontWeight: "bold" },
        }}
      />
    </Stack>
  );
}
