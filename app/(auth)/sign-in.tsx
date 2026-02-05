import { useSignIn, useOAuth, useUser } from '@clerk/clerk-expo'
import { Link, useRouter } from 'expo-router'
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { useWarmUpBrowser } from '../../hooks/useWarmUpBrowser'

WebBrowser.maybeCompleteAuthSession()

/**
 * Render the sign-in screen and manage email/password and Google OAuth sign-in flows.
 *
 * Performs browser warm-up, accepts user credentials, attempts authentication, sets the active session on successful sign-in, and navigates to the app root. Displays error messages when sign-in fails and prevents duplicate OAuth attempts when the user is already signed in.
 *
 * @returns The sign-in page UI as a React element
 */
export default function Page() {
  useWarmUpBrowser()
  const { signIn, setActive, isLoaded } = useSignIn()
  const { isSignedIn } = useUser()
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' })
  const router = useRouter()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const onSignInPress = async () => {
    if (!isLoaded) return
    setLoading(true)
    setError('')

    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      })

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId })
        router.replace('/')
      } else {
        console.error(JSON.stringify(signInAttempt, null, 2))
        setError('Sign in incomplete. Please check your credentials.')
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2))
      setError(err.errors?.[0]?.message || 'An error occurred during sign in.')
    } finally {
      setLoading(false)
    }
  }

  const onGoogleSignInPress = React.useCallback(async () => {
    if (isSignedIn) {
      router.replace('/')
      return
    }
    try {
      const { createdSessionId, setActive } = await startOAuthFlow({
        redirectUrl: Linking.createURL('/', { scheme: 'travo' }),
      })

      if (createdSessionId) {
        setActive!({ session: createdSessionId })
        router.replace('/')
      } else {
        // Use signIn or signUp for next steps such as MFA
      }
    } catch (err: any) {
      const message = typeof err?.message === 'string' ? err.message : ''
      if (message.toLowerCase().includes('already signed in')) {
        router.replace('/')
        return
      }
      console.error('OAuth error', err)
      setError('Failed to sign in with Google.')
    }
  }, [isSignedIn, router, startOAuthFlow])

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-50"
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-10">
        <View className="items-center mb-10">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 mb-4">
            <Ionicons name="airplane" size={40} color="#6366f1" />
          </View>
          <Text className="text-3xl font-extrabold text-slate-900">Travo</Text>
          <Text className="mt-2 text-center text-base text-slate-500">
            Welcome back! Please sign in to continue.
          </Text>
        </View>

        <View className="rounded-3xl bg-white p-6 shadow-lg">
          {error ? (
            <View className="mb-4 flex-row items-start rounded-xl bg-red-50 p-3">
              <View className="mr-2 mt-0.5">
                <Ionicons name="alert-circle" size={20} color="#ef4444" />
              </View>
              <Text className="text-sm text-red-700 flex-1">{error}</Text>
            </View>
          ) : null}

          <View className="mb-4 flex-row items-center rounded-xl bg-slate-100 px-4">
            <View className="mr-3">
              <Ionicons name="mail-outline" size={20} color="#94a3b8" />
            </View>
            <TextInput
              autoCapitalize="none"
              value={emailAddress}
              placeholder="Email address"
              placeholderTextColor="#94a3b8"
              onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
              className="flex-1 h-12 text-base text-slate-900"
            />
          </View>

          <View className="mb-4 flex-row items-center rounded-xl bg-slate-100 px-4">
            <View className="mr-3">
              <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" />
            </View>
            <TextInput
              value={password}
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              secureTextEntry={true}
              onChangeText={(password) => setPassword(password)}
              className="flex-1 h-12 text-base text-slate-900"
            />
          </View>

          <TouchableOpacity
            onPress={onSignInPress}
            className={`mt-2 h-12 items-center justify-center rounded-xl ${
              loading ? 'bg-indigo-300' : 'bg-indigo-500'
            }`}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-white">Sign In</Text>
            )}
          </TouchableOpacity>

          <View className="my-5 flex-row items-center">
            <View className="h-px flex-1 bg-slate-200" />
            <Text className="mx-2 text-xs font-medium text-slate-400">OR</Text>
            <View className="h-px flex-1 bg-slate-200" />
          </View>

          <TouchableOpacity
            onPress={onGoogleSignInPress}
            className="h-12 flex-row items-center justify-center rounded-xl border border-slate-200 bg-white"
          >
            <View className="mr-2">
              <Ionicons name="logo-google" size={20} color="#1e293b" />
            </View>
            <Text className="text-base font-semibold text-slate-800">
              Continue with Google
            </Text>
          </TouchableOpacity>

          <View className="mt-6 flex-row items-center justify-center">
            <Text className="text-sm text-slate-500">
              Don&apos;t have an account?
            </Text>
            <Link href="/sign-up" asChild>
              <TouchableOpacity>
                <Text className="ml-2 text-sm font-semibold text-indigo-500">
                  Sign up
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}