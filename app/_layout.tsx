import { ClerkProvider, useAuth } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY

function InitialLayout() {
  const { isLoaded, isSignedIn } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return

    const inAuthGroup = segments[0] === '(auth)'

    if (isSignedIn && inAuthGroup) {
      // Redirect to home if signed in but accessing auth screens
      router.replace('/')
    } else if (!isSignedIn && !inAuthGroup) {
      // Redirect to sign-in if not signed in and trying to access app
      router.replace('/sign-in')
    }
  }, [isSignedIn, isLoaded, segments, router])

  return <Slot />
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY!} tokenCache={tokenCache}>
      <InitialLayout />
    </ClerkProvider>
  )
}