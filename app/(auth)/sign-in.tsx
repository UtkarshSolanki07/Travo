import { useSignIn, useOAuth } from '@clerk/clerk-expo'
import { Link, useRouter } from 'expo-router'
import { Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native'
import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { useWarmUpBrowser } from '../../hooks/useWarmUpBrowser'

WebBrowser.maybeCompleteAuthSession()

export default function Page() {
  useWarmUpBrowser()
  const { signIn, setActive, isLoaded } = useSignIn()
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
      console.error('OAuth error', err)
      setError('Failed to sign in with Google.')
    }
  }, [router, startOAuthFlow])

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-50"
    >
      <ScrollView contentContainerClassName="flex-grow justify-center p-6">
        <View className="items-center mb-10">
          <View className="w-16 h-16 rounded-2xl bg-indigo-50 justify-center items-center mb-4">
            <Ionicons name="airplane" size={40} color="#6366f1" />
          </View>
          <Text className="text-3xl font-bold text-slate-800 mb-2">Travo</Text>
          <Text className="text-base text-slate-500 text-center">Welcome back! Please sign in to continue.</Text>
        </View>

        <View className="bg-white rounded-3xl p-6 shadow-sm">
          {error ? (
            <View className="flex-row items-center bg-red-50 p-3 rounded-xl mb-4 gap-2">
              <Ionicons name="alert-circle" size={20} color="#ef4444" />
              <Text className="text-red-700 text-sm flex-1">{error}</Text>
            </View>
          ) : null}

          <View className="flex-row items-center bg-slate-100 rounded-xl mb-4 px-4">
            <Ionicons name="mail-outline" size={20} color="#94a3b8" style={{ marginRight: 12 }} />
            <TextInput
              autoCapitalize="none"
              value={emailAddress}
              placeholder="Email address"
              placeholderTextColor="#94a3b8"
              onChangeText={(emailAddress) => setEmailAddress(emailAddress)}
              className="flex-1 h-12 text-base text-slate-800"
            />
          </View>

          <View className="flex-row items-center bg-slate-100 rounded-xl mb-4 px-4">
            <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={{ marginRight: 12 }} />
            <TextInput
              value={password}
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              secureTextEntry={true}
              onChangeText={(password) => setPassword(password)}
              className="flex-1 h-12 text-base text-slate-800"
            />
          </View>

          <TouchableOpacity 
            onPress={onSignInPress} 
            className={`bg-indigo-500 h-[52px] rounded-xl justify-center items-center mt-2 shadow-sm ${loading ? 'bg-indigo-300' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-base font-semibold">Sign In</Text>
            )}
          </TouchableOpacity>

          <View className="flex-row items-center my-5">
            <View className="flex-1 h-[1px] bg-slate-200" />
            <Text className="mx-2.5 text-slate-400 text-xs font-medium">OR</Text>
            <View className="flex-1 h-[1px] bg-slate-200" />
          </View>

          <TouchableOpacity 
            onPress={onGoogleSignInPress} 
            className="flex-row bg-white h-[52px] rounded-xl justify-center items-center border border-slate-200"
          >
            <Ionicons name="logo-google" size={20} color="#1e293b" style={{ marginRight: 10 }} />
            <Text className="text-slate-800 text-base font-semibold">Continue with Google</Text>
          </TouchableOpacity>

          <View className="flex-row justify-center items-center mt-6 gap-2">
            <Text className="text-slate-500 text-sm">Don&apos;t have an account?</Text>
            <Link href="./sign-up" asChild>
              <TouchableOpacity>
                <Text className="text-indigo-500 text-sm font-semibold">Sign up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
