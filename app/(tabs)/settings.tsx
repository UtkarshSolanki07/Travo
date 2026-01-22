import { SignedIn, SignedOut, useUser, useClerk } from '@clerk/clerk-expo'
import { Link, useNavigation, useRouter } from 'expo-router'
import {
  Text,
  View,
  StyleSheet,
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

/**
 * Render the Settings screen for managing privacy, live location sharing, account sessions, and user preferences.
 *
 * This component displays sections for Privacy & Security (including a live location toggle), Account Details
 * (list and switch between Clerk sessions, add new account), Preferences (navigate to edit interests), and Sign out.
 * It also handles loading state, persistently updating the user's live-tracking preference, starting/stopping
 * foreground location tracking, and updating the live location to the app context and backend.
 *
 * @returns The Settings screen as a React element to be rendered in the app.
 */
export default function SettingsScreen() {
  const { user: clerkUser } = useUser()
  const { client, setActive } = useClerk()
  const navigation = useNavigation()
  const router = useRouter()
  const { updateLocation } = useLocationContext()

  const [isLocationEnabled, setIsLocationEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  const trackingSubscription = useRef<LocationSubscription | null>(null)
  const interestsRef = useRef<string[]>([])

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

          if (clerkUser) {
            try {
              await database.updateLiveLocation(
                clerkUser.id,
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
  }, [clerkUser, updateLocation])

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
    router.push('/sign-up')
  }

  if (clerkUser && loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <SignedIn>
        <Text style={styles.headerTitle}>Settings</Text>

        {/* Privacy & Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Security</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="location-outline" size={24} color="#6366f1" />
              <View style={styles.textContainer}>
                <Text style={styles.settingLabel}>Share My Location</Text>
                <Text style={styles.settingDescription}>
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

          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#64748b" />
            <Text style={styles.infoText}>
              Your approximate location is shared to nearby users, not your exact address.
            </Text>
          </View>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          
          {client.sessions.map((session) => (
            <TouchableOpacity 
              key={session.id} 
              style={[
                styles.accountRow,
                session.user?.id === clerkUser?.id && styles.activeAccountRow
              ]}
              onPress={() => session.user?.id !== clerkUser?.id && handleSwitchAccount(session.id)}
            >
              <View style={styles.settingInfo}>
                <Ionicons 
                  name={session.user?.id === clerkUser?.id ? "person" : "person-outline"} 
                  size={24} 
                  color={session.user?.id === clerkUser?.id ? "#6366f1" : "#64748b"} 
                />
                <View style={styles.textContainer}>
                  <Text style={[
                    styles.settingLabel,
                    session.user?.id === clerkUser?.id && styles.activeAccountLabel
                  ]}>
                    {session.user?.fullName || session.user?.username || 'User'}
                    {session.user?.id === clerkUser?.id && " (Active)"}
                  </Text>
                  <Text style={styles.settingDescription}>
                    {session.user?.primaryEmailAddress?.emailAddress}
                  </Text>
                </View>
              </View>
              {session.user?.id !== clerkUser?.id && (
                <Ionicons name="swap-horizontal" size={20} color="#cbd5e1" />
              )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.addAccountButton} onPress={handleCreateNewAccount}>
            <Ionicons name="person-add-outline" size={20} color="#6366f1" />
            <Text style={styles.addAccountText}>Add New Account</Text>
          </TouchableOpacity>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => navigation.navigate('EditInterests' as never)}
          >
            <View style={styles.settingInfo}>
              <Ionicons name="star-outline" size={24} color="#6366f1" />
              <View style={styles.textContainer}>
                <Text style={styles.settingLabel}>Interests</Text>
                <Text style={styles.settingDescription}>
                  Choose what you like so we can suggest better activities and people.
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <View style={styles.section}>
          <View style={styles.buttonContainer}>
            <SignOutButton />
          </View>
        </View>
      </SignedIn>

      <SignedOut>
        <View style={styles.loggedOutContainer}>
          <Ionicons name="settings-outline" size={60} color="#64748b" />
          <Text style={styles.title}>Settings Unavailable</Text>
          <Text style={styles.subtitle}>Please sign in to access your settings.</Text>
          <Link href="/sign-in" style={styles.link}>
            <Text style={styles.linkText}>Sign in</Text>
          </Link>
        </View>
      </SignedOut>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    padding: 24,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 24,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  textContainer: {
    marginLeft: 16,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  settingDescription: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#94a3b8',
    flex: 1,
  },
  buttonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  loggedOutContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginVertical: 16,
  },
  link: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  linkText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  activeAccountRow: {
    backgroundColor: '#f0f4ff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: -12,
  },
  activeAccountLabel: {
    color: '#6366f1',
  },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 8,
  },
  addAccountText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366f1',
  },
})