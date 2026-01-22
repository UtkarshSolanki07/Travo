import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { LocationProvider } from '../context/LocationContext'
import { database } from '../services/database'

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY

/**
 * Render nested routes while enforcing authentication and synchronizing signed-in users.
 *
 * When the auth state is loaded, this layout syncs the current user's profile to the database if the user is signed in and within the auth group, and redirects to the sign-in screen if the user is not signed in and not within the auth group.
 *
 * @returns The Slot element that renders child routes for this layout.
 */
function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return

    const inAuthGroup = segments[0] === '(auth)'

    if (isSignedIn && inAuthGroup) {
      // Sync user data to Supabase
      if (user) {
        database.syncUser(
          user.id,
          user.emailAddresses[0]?.emailAddress,
          user.username || user.firstName || 'user',
          user.fullName,
          user.imageUrl
        ).catch(err => console.error('Error syncing user:', err))
      }
      
      // Removed redirection to '/' as it prevents adding additional accounts via (auth) screens
    } else if (!isSignedIn && !inAuthGroup) {
      // Redirect to sign-in if not signed in and trying to access app
      router.replace('/sign-in')
    }
  }, [isSignedIn, isLoaded, segments, router, user])

  return <Slot />
}

/**
 * Wraps the app's initial layout with Clerk authentication and location context providers.
 *
 * @returns A JSX element containing ClerkProvider (configured with the publishable key and token cache)
 *          and LocationProvider that render the InitialLayout.
 */
export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY!} tokenCache={tokenCache}>
      <LocationProvider>
        <InitialLayout />
      </LocationProvider>
    </ClerkProvider>
  )
}