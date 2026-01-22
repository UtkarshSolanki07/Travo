import 'react-native-url-polyfill/auto'
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { LocationProvider } from '../context/LocationContext'
import { database } from '../services/database'

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY

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
      const email = user?.emailAddresses[0]?.emailAddress
      if (user && email) {
        database.syncUser(
          user.id,
          email,
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

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY!} tokenCache={tokenCache}>
      <LocationProvider>
        <InitialLayout />
      </LocationProvider>
    </ClerkProvider>
  )
}