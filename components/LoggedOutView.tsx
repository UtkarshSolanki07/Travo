import { View, Text } from 'react-native'
import { Link } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

/**
 * Display a centered view informing the user they are not signed in and offering sign-in and sign-up actions.
 *
 * @returns A JSX.Element containing a lock icon, a title and subtitle, and navigation links to "/sign-in" and "/sign-up".
 */
export default function LoggedOutView() {
  return (
    <View className="flex-1 items-center justify-center mt-24">
      <Ionicons name="lock-closed" size={60} color="#64748b" />
      <Text className="text-2xl font-bold text-slate-800 text-center">
        You are not signed in
      </Text>
      <Text className="text-base text-slate-500 text-center mt-2 mb-8">
        Sign in to customize your profile and share your journey.
      </Text>
      <View className="w-full gap-4">
        <Link href="/sign-in" className="bg-indigo-500 p-4 rounded-xl items-center">
          <Text className="text-white font-bold">Sign in</Text>
        </Link>
        <Link href="/sign-up" className="bg-white p-4 rounded-xl items-center border border-indigo-500">
          <Text className="text-indigo-500 font-bold">Sign up</Text>
        </Link>
      </View>
    </View>
  )
}