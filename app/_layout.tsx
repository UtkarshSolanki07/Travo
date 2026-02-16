import { ClerkProvider, useAuth, useUser } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import "react-native-url-polyfill/auto";
import { MapProvider } from "../context/MapContext";
import { database } from "../services/database";
// import "../services/locationTask"; // Register background task

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Provides the app's initial layout and enforces auth-related side effects for route entry.
 *
 * When authentication state is available, this component synchronizes signed-in users' profile
 * data to the database when the current route is within the "(auth)" group, and redirects
 * unauthenticated users to the sign-in page when they attempt to access non-auth routes.
 *
 * @returns The route placeholder element (`<Slot />`) that renders nested routes.
 */
function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (isSignedIn && inAuthGroup) {
      // Sync user data to Supabase
      const email = user?.emailAddresses[0]?.emailAddress;
      if (user && email) {
        database
          .syncUser(
            user.id,
            email,
            user.username || user.firstName || "user",
            user.fullName,
            user.imageUrl,
          )
          .catch((err) => console.error("Error syncing user:", err));
      }

      // Removed redirection to '/' as it prevents adding additional accounts via (auth) screens
    } else if (!isSignedIn && !inAuthGroup) {
      // Redirect to sign-in if not signed in and trying to access app
      router.replace("/sign-in");
    }
  }, [isSignedIn, isLoaded, segments, router, user]);

  return <Slot />;
}

/**
 * App root layout that provides authentication and map contexts for the application.
 *
 * Renders a ClerkProvider configured with the publishable key and token cache, wraps a MapProvider, and mounts the InitialLayout.
 *
 * @returns The root React element containing authentication and map providers with the initial app layout
 */
export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <MapProvider>
        <InitialLayout />
      </MapProvider>
    </ClerkProvider>
  );
}