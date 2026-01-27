import * as React from 'react'
import { Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native'
import { useSignUp, useOAuth } from '@clerk/clerk-expo'
import { Link, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { useWarmUpBrowser } from '../../hooks/useWarmUpBrowser'

WebBrowser.maybeCompleteAuthSession()

export default function SignUpScreen() {
  useWarmUpBrowser()
  const { isLoaded, signUp, setActive } = useSignUp()
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' })
  const router = useRouter()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [pendingVerification, setPendingVerification] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  // Handle submission of sign-up form
  const onSignUpPress = async () => {
    if (!isLoaded) return
    setLoading(true)
    setError('')

    try {
      await signUp.create({
        emailAddress,
        username,
        password,
      })

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setPendingVerification(true)
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2))
      setError(err.errors?.[0]?.message || 'An error occurred during sign up.')
    } finally {
      setLoading(false)
    }
  }

  // Handle submission of verification form
  const onVerifyPress = async () => {
    if (!isLoaded) return
    setLoading(true)
    setError('')

    try {
      const signUpAttempt = await signUp.attemptEmailAddressVerification({
        code,
      })

      if (signUpAttempt.status === 'complete') {
        await setActive({ session: signUpAttempt.createdSessionId })
        router.replace('/')
      } else {
        console.error(JSON.stringify(signUpAttempt, null, 2))
        setError('Verification incomplete. Please check the code.')
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2))
      setError(err.errors?.[0]?.message || 'An error occurred during verification.')
    } finally {
      setLoading(false)
    }
  }

  const onGoogleSignUpPress = React.useCallback(async () => {
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
      setError('Failed to sign up with Google.')
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
          <Text className="text-base text-slate-500 text-center">
            {pendingVerification ? 'Verify your email' : 'Create an account to start your journey.'}
          </Text>
        </View>

        <View className="bg-white rounded-3xl p-6 shadow-sm">
          {error ? (
            <View className="flex-row items-center bg-red-50 p-3 rounded-xl mb-4 gap-2">
              <Ionicons name="alert-circle" size={20} color="#ef4444" />
              <Text className="text-red-700 text-sm flex-1">{error}</Text>
            </View>
          ) : null}

          {pendingVerification ? (
            <>
              <View className="flex-row items-center bg-slate-100 rounded-xl mb-4 px-4">
                <Ionicons name="key-outline" size={20} color="#94a3b8" style={{ marginRight: 12 }} />
                <TextInput
                  value={code}
                  placeholder="Verification code"
                  placeholderTextColor="#94a3b8"
                  onChangeText={(code) => setCode(code)}
                  className="flex-1 h-12 text-base text-slate-800"
                  keyboardType="number-pad"
                />
              </View>

              <TouchableOpacity 
                onPress={onVerifyPress} 
                className={`bg-indigo-500 h-[52px] rounded-xl justify-center items-center mt-2 shadow-sm ${loading ? 'bg-indigo-300' : ''}`}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white text-base font-semibold">Verify Email</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => setPendingVerification(false)} 
                className="mt-4 items-center"
              >
                <Text className="text-slate-500 text-sm font-medium">Back to Sign Up</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View className="flex-row items-center bg-slate-100 rounded-xl mb-4 px-4">
                <Ionicons name="person-outline" size={20} color="#94a3b8" style={{ marginRight: 12 }} />
                <TextInput
                  autoCapitalize="none"
                  value={username}
                  placeholder="Username"
                  placeholderTextColor="#94a3b8"
                  onChangeText={(val) => setUsername(val)}
                  className="flex-1 h-12 text-base text-slate-800"
                />
              </View>

              <View className="flex-row items-center bg-slate-100 rounded-xl mb-4 px-4">
                <Ionicons name="mail-outline" size={20} color="#94a3b8" style={{ marginRight: 12 }} />
                <TextInput
                  autoCapitalize="none"
                  value={emailAddress}
                  placeholder="Email address"
                  placeholderTextColor="#94a3b8"
                  onChangeText={(email) => setEmailAddress(email)}
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
                onPress={onSignUpPress} 
                className={`bg-indigo-500 h-[52px] rounded-xl justify-center items-center mt-2 shadow-sm ${loading ? 'bg-indigo-300' : ''}`}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white text-base font-semibold">Create Account</Text>
                )}
              </TouchableOpacity>

              <View className="flex-row items-center my-5">
                <View className="flex-1 h-[1px] bg-slate-200" />
                <Text className="mx-2.5 text-slate-400 text-xs font-medium">OR</Text>
                <View className="flex-1 h-[1px] bg-slate-200" />
              </View>

              <TouchableOpacity 
                onPress={onGoogleSignUpPress} 
                className="flex-row bg-white h-[52px] rounded-xl justify-center items-center border border-slate-200"
              >
                <Ionicons name="logo-google" size={20} color="#1e293b" style={{ marginRight: 10 }} />
                <Text className="text-slate-800 text-base font-semibold">Continue with Google</Text>
              </TouchableOpacity>

              <View className="flex-row justify-center items-center mt-6 gap-2">
                <Text className="text-slate-500 text-sm">Already have an account?</Text>
                <Link href="./sign-in" asChild>
                  <TouchableOpacity>
                    <Text className="text-indigo-500 text-sm font-semibold">Sign in</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
