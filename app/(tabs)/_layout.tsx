import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

/**
 * Renders the app's bottom tab navigator containing Map and Profile tabs.
 *
 * @returns A React element: a Tabs navigator with headers hidden and two screens — "Map" (map-outline icon) and "Profile" (person-outline icon).
 */
export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}