import { Tabs } from "expo-router";
import { FontAwesome6 } from "@expo/vector-icons";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="(Groups)"
        options={{
          headerShown: false,
          title: "Grupos",
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="users-rectangle" size={24} color={color} />
          ),
          tabBarActiveTintColor: "#2F031A",
          tabBarInactiveTintColor: "#909090",
        }}
      />
      <Tabs.Screen
        name="Profile"
        options={{
          headerShown: false,
          title: "Perfil",
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="user" size={24} color={color} />
          ),
          tabBarActiveTintColor: "#2F031A",
          tabBarInactiveTintColor: "#909090",
        }}
      />
    </Tabs>
  );
}
