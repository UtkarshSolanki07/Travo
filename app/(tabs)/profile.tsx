import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo'
import { Link } from 'expo-router'
import { Text, View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Image, Alert } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useState, useEffect, useCallback } from 'react'
import { database, User } from '@/services/database'
import { uploadToCloudinary } from '@/lib/cloudinary'

const INITIAL_INTERESTS = [
  'Clubbing', 'Cafe Hopping', 'Museums', 'Hiking', 
  'Beach', 'Going to new places', 'Shopping', 'Dining',
  'Outdoor Sports', 'Live Music', 'Art Galleries'
]

/**
 * Render the user's profile screen with viewing and editing capabilities.
 *
 * Loads profile and stats for the authenticated Clerk user and presents a UI that:
 * - Displays avatar, display name, location, bio, and profile stats (friends, activities).
 * - Allows toggling edit mode to change display name, bio, city, country, and avatar (uploads to Cloudinary).
 * - Manages interests with a preset list plus the ability to add custom interests; selections are persisted to the database.
 * - Shows a signed-out placeholder with links to sign in or sign up when no user is authenticated.
 *
 * @returns The React element for the profile screen UI.
 */
export default function ProfileScreen() {
  const { user: clerkUser } = useUser()
  
  // Profile Data
  const [userData, setUserData] = useState<User | null>(null)
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [friendsCount, setFriendsCount] = useState(0)
  const [activitiesCount, setActivitiesCount] = useState(0)
  
  // UI States
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingData, setEditingData] = useState<Partial<User>>({})
  const [customInterest, setCustomInterest] = useState('')

  const loadProfile = useCallback(async () => {
    if (!clerkUser) return
    setLoading(true)
    try {
      // Get core user data
      const user = await database.getUser(clerkUser.id)
      if (user) {
        setUserData(user)
        setEditingData(user)
      }

      // Get profile/interests/stats data
      const profile = await database.getProfile(clerkUser.id)
      if (profile) {
        setSelectedInterests(profile.interests || [])
        setFriendsCount(profile.friends_count || 0)
        setActivitiesCount(profile.activities_count || 0)
      }
    } catch (_error) {
      console.error('Error loading profile:', _error)
    } finally {
      setLoading(false)
    }
  }, [clerkUser])

  useEffect(() => {
    if (clerkUser) {
      loadProfile()
    }
  }, [clerkUser, loadProfile])

  const toggleInterest = async (interest: string) => {
    const newInterests = selectedInterests.includes(interest)
      ? selectedInterests.filter(i => i !== interest)
      : [...selectedInterests, interest]
    
    setSelectedInterests(newInterests)

    if (clerkUser) {
      await database.updateProfile(clerkUser.id, {
        interests: newInterests
      })
    }
  }

  const addCustomInterest = async () => {
    if (!customInterest.trim()) return
    const interest = customInterest.trim()
    if (selectedInterests.includes(interest)) {
      setCustomInterest('')
      return
    }
    
    const newInterests = [...selectedInterests, interest]
    setSelectedInterests(newInterests)
    setCustomInterest('')

    if (clerkUser) {
      await database.updateProfile(clerkUser.id, {
        interests: newInterests
      })
    }
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0].uri) {
      try {
        setSaving(true)
        const uploadUrl = await uploadToCloudinary(result.assets[0].uri)
        
        // Update local state
        setEditingData(prev => ({ ...prev, avatar_url: uploadUrl }))
        
        // Save to database immediately if we have a user
        if (clerkUser) {
          await database.updateUser(clerkUser.id, { avatar_url: uploadUrl })
          setUserData(prev => prev ? { ...prev, avatar_url: uploadUrl } : null)
        }
        
        Alert.alert('Success', 'Profile picture updated successfully!')
      } catch (error) {
        console.error('Upload/Save error:', error)
        Alert.alert('Error', 'Failed to update profile picture')
      } finally {
        setSaving(false)
      }
    }
  }

  const handleSaveProfile = async () => {
    if (!clerkUser) return
    setSaving(true)
    try {
      await database.updateUser(clerkUser.id, editingData)
      setUserData({ ...userData, ...editingData } as User)
      setIsEditing(false)
      Alert.alert('Success', 'Profile updated successfully!')
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile')
    } finally {
      setSaving(false)
    }
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
        {/* Header Section */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={isEditing ? pickImage : undefined}
            style={styles.avatarWrapper}
          >
            <View style={styles.avatarContainer}>
              {editingData.avatar_url || userData?.avatar_url ? (
                <Image 
                  source={{ uri: editingData.avatar_url || userData?.avatar_url }} 
                  style={styles.avatar} 
                />
              ) : (
                <Ionicons name="person-circle" size={100} color="#6366f1" />
              )}
            </View>
            {isEditing && (
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={20} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          
          {isEditing ? (
              <View style={styles.editForm}>
              <TextInput
                style={styles.input}
                placeholder="Display Name"
                value={editingData.display_name || ''}
                onChangeText={(text) => setEditingData({ ...editingData, display_name: text })}
              />
              <TextInput
                style={[styles.input, styles.bioInput]}
                placeholder="Bio"
                multiline
                numberOfLines={3}
                value={editingData.bio || ''}
                onChangeText={(text) => setEditingData({ ...editingData, bio: text })}
              />
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                  placeholder="City"
                  value={editingData.city || ''}
                  onChangeText={(text) => setEditingData({ ...editingData, city: text })}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Country"
                  value={editingData.country || ''}
                  onChangeText={(text) => setEditingData({ ...editingData, country: text })}
                />
              </View>
              <View style={styles.editActions}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.cancelButton]} 
                  onPress={() => {
                    setIsEditing(false)
                    setEditingData(userData || {})
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.saveButton]} 
                  onPress={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.title}>{userData?.display_name || userData?.username || 'Traveler'}</Text>
              <Text style={styles.locationText}>
                {userData?.city ? `${userData.city}, ` : ''}{userData?.country || 'No location set'}
              </Text>
              {userData?.bio && (
                <Text style={styles.bioText}>{userData.bio}</Text>
              )}
              
              {/* Stats Section */}
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{friendsCount}</Text>
                  <Text style={styles.statLabel}>Friends</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{activitiesCount}</Text>
                  <Text style={styles.statLabel}>Activities</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.editProfileBtn}
                onPress={() => setIsEditing(true)}
              >
                <Ionicons name="create-outline" size={16} color="#6366f1" />
                <Text style={styles.editProfileText}>Edit Profile</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Interests Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          
          <View style={styles.addInterestContainer}>
            <TextInput
              style={styles.interestInput}
              placeholder="Add your own interest..."
              value={customInterest}
              onChangeText={setCustomInterest}
              onSubmitEditing={addCustomInterest}
            />
            <TouchableOpacity 
              style={styles.addInterestBtn}
              onPress={addCustomInterest}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.interestsContainer}>
            {/* Show selected interests first (especially custom ones) */}
            {selectedInterests.map(interest => (
              <TouchableOpacity 
                key={interest}
                style={[styles.interestChip, styles.interestChipSelected]}
                onPress={() => toggleInterest(interest)}
              >
                <Text style={[styles.interestText, styles.interestTextSelected]}>
                  {interest}
                </Text>
              </TouchableOpacity>
            ))}
            
            {/* Show available preset interests that aren't selected */}
            {INITIAL_INTERESTS.filter(i => !selectedInterests.includes(i)).map(interest => (
              <TouchableOpacity 
                key={interest}
                style={styles.interestChip}
                onPress={() => toggleInterest(interest)}
              >
                <Text style={styles.interestText}>
                  {interest}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SignedIn>

      <SignedOut>
        <View style={styles.loggedOutContainer}>
          <Ionicons name="lock-closed" size={60} color="#64748b" />
          <Text style={styles.title}>You are not signed in</Text>
          <Text style={styles.subtitle}>Sign in to customize your profile and share your journey.</Text>
          <View style={styles.authLinks}>
            <Link href="/sign-in" style={styles.link}>
              <Text style={styles.linkText}>Sign in</Text>
            </Link>
            <Link href="/sign-up" style={styles.outlineLink}>
              <Text style={styles.outlineLinkText}>Sign up</Text>
            </Link>
          </View>
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
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarContainer: {
    padding: 4,
    backgroundColor: '#fff',
    borderRadius: 60,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: 110,
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#6366f1',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  editForm: {
    width: '100%',
    paddingHorizontal: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    color: '#475569',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#6366f1',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  editProfileText: {
    marginLeft: 6,
    color: '#6366f1',
    fontWeight: '600',
    fontSize: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
  },
  locationText: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 4,
  },
  bioText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e2e8f0',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  bioInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  addInterestContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  interestInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  addInterestBtn: {
    backgroundColor: '#6366f1',
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  interestChipSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  interestText: {
    fontSize: 14,
    color: '#475569',
  },
  interestTextSelected: {
    color: '#fff',
    fontWeight: '500',
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
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  authLinks: {
    width: '100%',
    gap: 15,
  },
  link: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    textAlign: 'center',
  },
  linkText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  outlineLink: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  outlineLinkText: {
    color: '#6366f1',
    fontWeight: 'bold',
  },
});