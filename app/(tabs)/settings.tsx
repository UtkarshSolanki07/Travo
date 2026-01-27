import { SignedIn, SignedOut, useUser, useClerk } from '@clerk/clerk-expo'
import { Link, useRouter } from 'expo-router'
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native'
import { SignOutButton } from '@/components/SignOutButton'
import { Ionicons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocationContext } from '@/context/LocationContext'
import { database } from '@/services/database'
import type { LocationSubscription } from 'expo-location'

export default function SettingsScreen() {
  const { user: clerkUser } = useUser()
  const { client, setActive } = useClerk()
  const router = useRouter()
  const { updateLocation } = useLocationContext()

  const [isLocationEnabled, setIsLocationEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  const trackingSubscription = useRef<LocationSubscription | null>(null)
  const interestsRef = useRef<string[]>([])
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    userIdRef.current = clerkUser?.id ?? null
  }, [clerkUser])

  const stopTracking = useCallback(() => {
    if (trackingSubscription.current) {
      trackingSubscription.current.remove()
      trackingSubscription.current = null
    }
  }, [])

  const startTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()

      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Needed',
          'Enable location in system settings to share your position on the map.',
        )
        setIsLocationEnabled(false)
        return
      }

      // clear previous subscription if any
      if (trackingSubscription.current) {
        trackingSubscription.current.remove()
      }
      
      trackingSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 25,   // meters
          timeInterval: 10000,    // ms
        },
        async (location) => {
          const { latitude, longitude } = location.coords
          updateLocation(latitude, longitude)

          const userId = userIdRef.current
          if (userId) {
            try {
              await database.updateLiveLocation(
                userId,
                latitude,
                longitude,
                interestsRef.current,
              )
            } catch (err) {
              console.error('Failed to update live location', err)
            }
          }
        },
      )
    } catch (error) {
      console.error('Error in tracking:', error)
      Alert.alert('Error', 'Unable to start location tracking right now.')
      setIsLocationEnabled(false)
    }
  }, [updateLocation])

  const loadSettings = useCallback(async () => {
    if (!clerkUser) return

    setLoading(true)
    try {
      const profile = await database.getProfile(clerkUser.id)

      if (profile) {
        const enabled = !!profile.is_live_tracking
        setIsLocationEnabled(enabled)
        interestsRef.current = profile.interests || []

        if (enabled) {
          await startTracking()
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      Alert.alert('Error', 'Failed to load your settings.')
    } finally {
      setLoading(false)
    }
  }, [clerkUser, startTracking])

  useEffect(() => {
    if (clerkUser) {
      loadSettings()
    }

    return () => {
      stopTracking()
    }
  }, [clerkUser, loadSettings, stopTracking])

  const handleToggleLocation = async (value: boolean) => {
    const previous = isLocationEnabled
    setIsLocationEnabled(value)

    if (!clerkUser) return

    try {
      await database.updateProfile(clerkUser.id, {
        is_live_tracking: value,
        interests: interestsRef.current,
      })
    } catch (error) {
      console.error('Failed to update tracking status', error)
      Alert.alert('Error', 'Failed to update tracking status.')
      setIsLocationEnabled(previous)
      return
    }

    if (value) {
      await startTracking()
    } else {
      stopTracking()
    }
  }

  const handleSwitchAccount = async (sessionId: string) => {
    try {
      setLoading(true)
      await setActive({ session: sessionId })
    } catch (error) {
      console.error('Failed to switch account', error)
      Alert.alert('Error', 'Failed to switch account.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNewAccount = () => {
    router.push('./(auth)/sign-up')
  }

  if (clerkUser && loading) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="p-6 pt-[60px]">
      <SignedIn>
        <Text className="text-3xl font-bold text-slate-800 mb-6">Settings</Text>

        {/* Privacy & Security */}
        <View className="bg-white rounded-[20px] p-5 mb-5 shadow-sm">
          <Text className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">Privacy & Security</Text>

          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center flex-1 mr-4">
              <Ionicons name="location-outline" size={24} color="#6366f1" />
              <View className="ml-4 flex-1">
                <Text className="text-base font-semibold text-slate-800">Share My Location</Text>
                <Text className="text-[13px] text-slate-500 mt-0.5">
                  Share your live location while the app is open. You can turn this off anytime.
                </Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: '#e2e8f0', true: '#a5b4fc' }}
              thumbColor={isLocationEnabled ? '#6366f1' : '#f1f5f9'}
              onValueChange={handleToggleLocation}
              value={isLocationEnabled}
            />
          </View>

          <View className="flex-row items-start mt-2">
            <Ionicons name="shield-checkmark-outline" size={18} color="#64748b" />
            <Text className="ml-2 text-xs text-slate-400 flex-1">
              Your approximate location is shared to nearby users, not your exact address.
            </Text>
          </View>
        </View>

        {/* Account */}
        <View className="bg-white rounded-[20px] p-5 mb-5 shadow-sm">
          <Text className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">Account Details</Text>
          
          {client?.sessions?.map((session) => (
            <TouchableOpacity 
              key={session.id} 
              className={`flex-row items-center justify-between py-3 border-b border-slate-100 ${
                session.user?.id === clerkUser?.id ? 'bg-indigo-50/50 rounded-xl px-3 -mx-3' : ''
              }`}
              onPress={() => session.user?.id !== clerkUser?.id && handleSwitchAccount(session.id)}
            >
              <View className="flex-row items-center flex-1 mr-4">
                <Ionicons 
                  name={session.user?.id === clerkUser?.id ? "person" : "person-outline"} 
                  size={24} 
                  color={session.user?.id === clerkUser?.id ? "#6366f1" : "#64748b"} 
                />
                <View className="ml-4 flex-1">
                  <Text className={`text-base font-semibold ${
                    session.user?.id === clerkUser?.id ? 'text-indigo-500' : 'text-slate-800'
                  }`}>
                    {session.user?.fullName || session.user?.username || 'User'}
                    {session.user?.id === clerkUser?.id && " (Active)"}
                  </Text>
                  <Text className="text-[13px] text-slate-500 mt-0.5">
                    {session.user?.primaryEmailAddress?.emailAddress}
                  </Text>
                </View>
              </View>
              {session.user?.id !== clerkUser?.id && (
                <Ionicons name="swap-horizontal" size={20} color="#cbd5e1" />
              )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity className="flex-row items-center gap-2 mt-4 py-2" onPress={handleCreateNewAccount}>
            <Ionicons name="person-add-outline" size={20} color="#6366f1" />
            <Text className="text-[15px] font-semibold text-indigo-500">Add New Account</Text>
          </TouchableOpacity>
        </View>

        {/* Preferences */}
        <View className="bg-white rounded-[20px] p-5 mb-5 shadow-sm">
          <Text className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">Preferences</Text>

          <TouchableOpacity
            className="flex-row items-center justify-between py-3"
            onPress={() => router.push('/profile')}
          >
            <View className="flex-row items-center flex-1 mr-4">
              <Ionicons name="star-outline" size={24} color="#6366f1" />
              <View className="ml-4 flex-1">
                <Text className="text-base font-semibold text-slate-800">Interests</Text>
                <Text className="text-[13px] text-slate-500 mt-0.5">
                  Choose what you like so we can suggest better activities and people.
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <View className="bg-white rounded-[20px] p-5 mb-5 shadow-sm">
          <View className="rounded-xl overflow-hidden">
            <SignOutButton />
          </View>
        </View>
      </SignedIn>

      <SignedOut>
        <View className="flex-1 items-center justify-center mt-[100px]">
          <Ionicons name="settings-outline" size={60} color="#64748b" />
          <Text className="text-2xl font-bold text-slate-800 mt-4">Settings Unavailable</Text>
          <Text className="text-base text-slate-500 text-center my-4">Please sign in to access your settings.</Text>
          <Link href="./(auth)/sign-in" className="bg-indigo-500 px-8 py-3 rounded-xl">
            <Text className="text-white font-bold text-base">Sign in</Text>
          </Link>
        </View>
      </SignedOut>
    </ScrollView>
  )
}
