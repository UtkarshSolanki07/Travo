import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo'
import { Link } from 'expo-router'
import { Text, View, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Image, Alert, Dimensions, Modal, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useState, useEffect, useCallback, useRef } from 'react'
import * as Location from 'expo-location'
import { useLocationContext } from '@/context/LocationContext'
import { database, User, Post, PostComment } from '@/services/database'
import { uploadToCloudinary, getAvatarUrl, getOptimizedUrl, getVideoThumbUrl } from '@/lib/cloudinary'
import { searchVenues, searchLocations } from '@/services/maptiler'
import debounce from 'lodash.debounce'

const { width } = Dimensions.get('window')
const COLUMN_WIDTH = (width - 64) / 3 // Padding and gap aware width

const INITIAL_INTERESTS = [
  'Clubbing', 'Cafe Hopping', 'Museums', 'Hiking', 
  'Beach', 'Going to new places', 'Shopping', 'Dining',
  'Outdoor Sports', 'Live Music', 'Art Galleries'
]

export default function ProfileScreen() {
  const { user: clerkUser } = useUser()
  const { userLocation, updateLocation } = useLocationContext()
  
  // Profile Data
  const [userData, setUserData] = useState<User | null>(null)
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [friendsCount, setFriendsCount] = useState(0)
  const [activitiesCount, setActivitiesCount] = useState(0)
  const [activeTab, setActiveTab] = useState<'posts' | 'tagged'>('posts')
  const [myPosts, setMyPosts] = useState<Post[]>([])
  const [taggedPosts, setTaggedPosts] = useState<Post[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  
  // UI States
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingData, setEditingData] = useState<Partial<User>>({})
  const [customInterest, setCustomInterest] = useState('')
  
  // Create Post States
  const [isCreatingPost, setIsCreatingPost] = useState(false)
  const [postText, setPostText] = useState('')
  const [postMedia, setPostMedia] = useState<{ uri: string, type: 'image' | 'video' } | null>(null)
  const [venueName, setVenueName] = useState('')
  const [locationName, setLocationName] = useState('')
  const [venueResults, setVenueResults] = useState<any[]>([])
  const [locationResults, setLocationResults] = useState<any[]>([])
  const [isSearchingVenue, setIsSearchingVenue] = useState(false)
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)
  const [creating, setCreating] = useState(false)

  // Post Detail States
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [isPostDetailVisible, setIsPostDetailVisible] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [newComment, setNewComment] = useState('')
  const [socialLoading, setSocialLoading] = useState(false)

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

      // Load Posts
      setPostsLoading(true)
      const [posts, tagged] = await Promise.all([
        database.getPosts(clerkUser.id),
        database.getTaggedPosts(clerkUser.id)
      ])
      setMyPosts(posts)
      setTaggedPosts(tagged)
    } catch (_error) {
      console.error('Error loading profile:', _error)
    } finally {
      setLoading(false)
      setPostsLoading(false)
    }
  }, [clerkUser])

  useEffect(() => {
    if (clerkUser) {
      loadProfile()
    }
  }, [clerkUser, loadProfile])

  const toggleInterest = async (interest: string) => {
    const previousInterests = [...selectedInterests]
    const newInterests = selectedInterests.includes(interest)
      ? selectedInterests.filter(i => i !== interest)
      : [...selectedInterests, interest]
    
    // Optimistic Update
    setSelectedInterests(newInterests)

    if (clerkUser) {
      try {
        await database.updateProfile(clerkUser.id, {
          interests: newInterests
        })
      } catch (error) {
        console.error('Error updating interests:', error)
        setSelectedInterests(previousInterests) // Rollback
        Alert.alert('Error', 'Failed to update interests. Please try again.')
      }
    }
  }

  const addCustomInterest = async () => {
    if (!customInterest.trim()) return
    const interest = customInterest.trim()
    if (selectedInterests.includes(interest)) {
      setCustomInterest('')
      return
    }
    
    const previousInterests = [...selectedInterests]
    const newInterests = [...selectedInterests, interest]
    
    // Optimistic Update
    setSelectedInterests(newInterests)
    setCustomInterest('')

    if (clerkUser) {
      try {
        await database.updateProfile(clerkUser.id, {
          interests: newInterests
        })
      } catch (error) {
        console.error('Error adding interest:', error)
        setSelectedInterests(previousInterests) // Rollback
        Alert.alert('Error', 'Failed to save interest. Please try again.')
      }
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
        const uploadUrl = await uploadToCloudinary(result.assets[0].uri, 'image')
        
        // Update local state selectively
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
      // Safe merge: ensure we don't lose existing fields not in editingData
      setUserData(prev => prev ? { ...prev, ...editingData } : null)
      setIsEditing(false)
      Alert.alert('Success', 'Profile updated successfully!')
    } catch (error) {
      console.error('Save profile error:', error)
      Alert.alert('Error', 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const pickPostMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0].uri) {
      setPostMedia({ 
        uri: result.assets[0].uri, 
        type: result.assets[0].type === 'video' ? 'video' : 'image' 
      })
    }
  }

  const handleCreatePost = async () => {
    if (!clerkUser) return
    if (!postMedia && !postText) {
      Alert.alert('Error', 'Please add some content to your post')
      return
    }

    setCreating(true)
    try {
      let mediaUrl = ''
      if (postMedia) {
        mediaUrl = await uploadToCloudinary(postMedia.uri, postMedia.type)
      }

      await database.createPost({
        author_id: clerkUser.id,
        text: postText,
        media_url: mediaUrl,
        media_type: postMedia?.type || 'note',
        venue_name: venueName,
        location_name: locationName,
        visibility: 'public'
      })

      Alert.alert('Success', 'Post created successfully!')
      setIsCreatingPost(false)
      setPostText('')
      setPostMedia(null)
      setVenueName('')
      setLocationName('')
      setVenueResults([])
      setLocationResults([])
      loadProfile() // Reload posts
    } catch (error) {
      console.error('Create post error:', error)
      Alert.alert('Error', 'Failed to create post')
    } finally {
      setCreating(false)
    }
  }

  const debouncedVenueSearch = useRef(
    debounce(async (query: string, currentLoc: any) => {
      setIsSearchingVenue(true)
      try {
        const results = await searchVenues(query, currentLoc || undefined)
        setVenueResults(results)
      } catch {
        console.error('Venue search error')
      } finally {
        setIsSearchingVenue(false)
      }
    }, 400)
  ).current

  const debouncedLocationSearch = useRef(
    debounce(async (query: string, currentLoc: any) => {
      setIsSearchingLocation(true)
      try {
        const results = await searchLocations(query, currentLoc || undefined)
        setLocationResults(results)
      } catch {
        console.error('Location search error')
      } finally {
        setIsSearchingLocation(false)
      }
    }, 400)
  ).current

  const handleSearchVenue = async (query: string) => {
    setVenueName(query)
    if (query.length < 3) {
      setVenueResults([])
      debouncedVenueSearch.cancel()
      return
    }

    // One-time fallback if userLocation is null
    let currentLoc = userLocation
    if (!currentLoc) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({})
          currentLoc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
          updateLocation(pos.coords.latitude, pos.coords.longitude)
        }
      } catch (e) { console.error('Silent location fetch failed', e) }
    }
    
    debouncedVenueSearch(query, currentLoc)
  }

  const handleSearchLocation = async (query: string) => {
    setLocationName(query)
    if (query.length < 3) {
      setLocationResults([])
      debouncedLocationSearch.cancel()
      return
    }

    let currentLoc = userLocation
    if (!currentLoc) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({})
          currentLoc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
          updateLocation(pos.coords.latitude, pos.coords.longitude)
        }
      } catch (e) { console.error('Silent location fetch failed', e) }
    }
    
    debouncedLocationSearch(query, currentLoc)
  }

  const selectVenue = (place: any) => {
    setVenueName(place.text || place.place_name.split(',')[0])
    setVenueResults([])

    // Auto-fill location if it's empty
    if (!locationName) {
      const city = place.context?.find((c: any) => c.id.startsWith('city'))?.text || ''
      const country = place.context?.find((c: any) => c.id.startsWith('country'))?.text || ''
      
      if (city || country) {
        setLocationName(`${city}${city && country ? ', ' : ''}${country}`)
      } else {
        // Fallback to parsing place_name if context is missing
        const parts = place.place_name.split(', ')
        if (parts.length > 2) {
          setLocationName(parts.slice(-2).join(', '))
        }
      }
    }
  }

  const selectLocation = (place: any) => {
    setLocationName(place.place_name)
    setLocationResults([])
  }

  const openPostDetail = async (post: Post) => {
    setSelectedPost(post)
    setIsPostDetailVisible(true)
    try {
      const postComments = await database.getComments(post.id)
      setComments(postComments)
    } catch (error) {
      console.error('Error loading comments:', error)
    }
  }

  const handleToggleLike = async () => {
    if (!clerkUser || !selectedPost) return
    try {
      const isLikedNow = await database.toggleLike(selectedPost.id, clerkUser.id)
      setSelectedPost(prev => prev ? { 
        ...prev, 
        is_liked: isLikedNow,
        likes_count: (prev.likes_count || 0) + (isLikedNow ? 1 : -1)
      } : null)
      // Update the post in the main lists too
      const updateList = (list: Post[]) => list.map(p => p.id === selectedPost.id ? { 
        ...p, 
        is_liked: isLikedNow,
        likes_count: (p.likes_count || 0) + (isLikedNow ? 1 : -1)
      } : p)
      setMyPosts(updateList)
      setTaggedPosts(updateList)
    } catch (error) {
      console.error('Like toggle error:', error)
    }
  }

  const handleAddComment = async () => {
    if (!clerkUser || !selectedPost || !newComment.trim()) return
    setSocialLoading(true)
    try {
      await database.addComment(selectedPost.id, clerkUser.id, newComment.trim())
      setNewComment('')
      const updatedComments = await database.getComments(selectedPost.id)
      setComments(updatedComments)
      // Ideally increment comments_count in local state too
    } catch (error) {
       Alert.alert('Error', 'Failed to add comment')
    } finally {
      setSocialLoading(false)
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
                  source={{ uri: getAvatarUrl(editingData.avatar_url || userData?.avatar_url, 200) }} 
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
              
              <View style={styles.headerActions}>
                <TouchableOpacity 
                  style={styles.editProfileBtn}
                  onPress={() => setIsEditing(true)}
                >
                  <Ionicons name="create-outline" size={16} color="#6366f1" />
                  <Text style={styles.editProfileText}>Edit Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.editProfileBtn, styles.addPostBtn]}
                  onPress={() => setIsCreatingPost(true)}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#fff" />
                  <Text style={[styles.editProfileText, { color: '#fff' }]}>Add Post</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Posts Section */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
            onPress={() => setActiveTab('posts')}
          >
            <Ionicons 
              name="grid-outline" 
              size={20} 
              color={activeTab === 'posts' ? '#6366f1' : '#64748b'} 
            />
            <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>My Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'tagged' && styles.activeTab]}
            onPress={() => setActiveTab('tagged')}
          >
            <Ionicons 
              name="people-outline" 
              size={20} 
              color={activeTab === 'tagged' ? '#6366f1' : '#64748b'} 
            />
            <Text style={[styles.tabText, activeTab === 'tagged' && styles.activeTabText]}>Tagged</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.postsGrid}>
          {postsLoading ? (
            <ActivityIndicator style={{ padding: 40 }} color="#6366f1" />
          ) : (
            (activeTab === 'posts' ? myPosts : taggedPosts).length > 0 ? (
              (activeTab === 'posts' ? myPosts : taggedPosts).map((post) => (
                <TouchableOpacity 
                  key={post.id} 
                  style={styles.postItem}
                  onPress={() => openPostDetail(post)}
                >
                  {post.media_url ? (
                    <Image 
                      source={{ 
                        uri: post.media_type === 'video' 
                          ? getVideoThumbUrl(post.media_url, { width: 300, height: 300 })
                          : getOptimizedUrl(post.media_url, { width: 300, height: 300 })
                      }} 
                      style={styles.postMedia} 
                    />
                  ) : (
                    <View style={styles.postTextOnly}>
                      <Text numberOfLines={3} style={styles.postTextPreview}>{post.text}</Text>
                    </View>
                  )}
                  {post.media_type === 'video' && (
                    <View style={styles.videoBadge}>
                      <Ionicons name="play" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyGrid}>
                <Ionicons 
                  name={activeTab === 'posts' ? "images-outline" : "person-add-outline"} 
                  size={48} 
                  color="#e2e8f0" 
                />
                <Text style={styles.emptyGridText}>
                  {activeTab === 'posts' ? "No posts yet" : "No tagged posts"}
                </Text>
              </View>
            )
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

        {/* Create Post Modal */}
        <Modal
          visible={isCreatingPost}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsCreatingPost(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create New Post</Text>
                <TouchableOpacity onPress={() => setIsCreatingPost(false)}>
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <TouchableOpacity 
                  style={styles.mediaPlaceholder} 
                  onPress={pickPostMedia}
                >
                  {postMedia ? (
                    <View style={styles.previewContainer}>
                      <Image source={{ uri: postMedia.uri }} style={styles.previewImage} />
                      <TouchableOpacity 
                        style={styles.removeMediaBtn}
                        onPress={() => setPostMedia(null)}
                      >
                        <Ionicons name="close-circle" size={24} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <Ionicons name="image-outline" size={48} color="#94a3b8" />
                      <Text style={styles.mediaPlaceholderText}>Add Photo or Video</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TextInput
                  style={[styles.input, styles.postTextInput]}
                  placeholder="What's on your mind?..."
                  multiline
                  value={postText}
                  onChangeText={setPostText}
                />

                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={20} color="#6366f1" />
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
                    placeholder="Place (e.g. Starburst Cafe, Eiffel Tower)"
                    value={venueName}
                    onChangeText={handleSearchVenue}
                  />
                  {isSearchingVenue && <ActivityIndicator size="small" color="#6366f1" />}
                </View>

                {venueResults.length > 0 && (
                  <View style={styles.searchResults}>
                    {venueResults.map((item, index) => (
                      <TouchableOpacity 
                        key={index} 
                        style={styles.searchItem}
                        onPress={() => selectVenue(item)}
                      >
                        <Ionicons name="pin-outline" size={16} color="#64748b" />
                        <Text style={styles.searchItemText} numberOfLines={1}>
                          {item.place_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View style={[styles.locationRow, { marginTop: 12 }]}>
                  <Ionicons name="globe-outline" size={20} color="#6366f1" />
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
                    placeholder="Search location..."
                    value={locationName}
                    onChangeText={handleSearchLocation}
                  />
                  {isSearchingLocation && <ActivityIndicator size="small" color="#6366f1" />}
                </View>

                {locationResults.length > 0 && (
                  <View style={styles.searchResults}>
                    {locationResults.map((item, index) => (
                      <TouchableOpacity 
                        key={index} 
                        style={styles.searchItem}
                        onPress={() => selectLocation(item)}
                      >
                        <Ionicons name="map-outline" size={16} color="#64748b" />
                        <Text style={styles.searchItemText} numberOfLines={1}>
                          {item.place_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.saveButton]}
                  onPress={handleCreatePost}
                  disabled={creating}
                >
                  {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Share Post</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Post Detail Modal */}
        <Modal
          visible={isPostDetailVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setIsPostDetailVisible(false)}
        >
          <View style={styles.detailOverlay}>
            <View style={styles.detailContent}>
              <View style={styles.detailHeader}>
                <View style={styles.detailAuthor}>
                  {selectedPost?.user?.avatar_url ? (
                    <Image 
                      source={{ uri: getAvatarUrl(selectedPost.user.avatar_url, 80) }} 
                      style={styles.authorAvatar} 
                    />
                  ) : (
                    <Ionicons name="person-circle" size={40} color="#6366f1" />
                  )}
                  <View>
                    <Text style={styles.authorName}>{selectedPost?.user?.display_name || 'User'}</Text>
                    {selectedPost?.location_name && (
                      <Text style={styles.authorLocation}>{selectedPost.location_name}</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => setIsPostDetailVisible(false)}>
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {selectedPost?.media_url && (
                  <Image 
                    source={{ 
                      uri: selectedPost.media_type === 'video'
                        ? getVideoThumbUrl(selectedPost.media_url, { width: 800 })
                        : getOptimizedUrl(selectedPost.media_url, { width: 800 })
                    }} 
                    style={styles.detailMedia} 
                  />
                )}
                
                <View style={styles.detailInfo}>
                  <View style={styles.socialActions}>
                    <TouchableOpacity onPress={handleToggleLike} style={styles.socialBtn}>
                      <Ionicons 
                        name={selectedPost?.is_liked ? "heart" : "heart-outline"} 
                        size={28} 
                        color={selectedPost?.is_liked ? "#ef4444" : "#64748b"} 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.socialBtn}>
                      <Ionicons name="chatbubble-outline" size={26} color="#64748b" />
                    </TouchableOpacity>
                  </View>

                  {selectedPost?.text && (
                    <Text style={styles.detailText}>
                      <Text style={{ fontWeight: 'bold' }}>{selectedPost?.user?.display_name} </Text>
                      {selectedPost.venue_name && <Text style={{ color: '#6366f1', fontWeight: '600' }}>at {selectedPost.venue_name} </Text>}
                      {selectedPost.text}
                    </Text>
                  )}

                  <View style={styles.commentsSection}>
                    <Text style={styles.commentsTitle}>Comments</Text>
                    {comments.map(comment => (
                      <View key={comment.id} style={styles.commentItem}>
                        {comment.user?.avatar_url ? (
                          <Image source={{ uri: getAvatarUrl(comment.user.avatar_url, 60) }} style={styles.commentAvatar} />
                        ) : (
                          <Ionicons name="person-circle" size={32} color="#94a3b8" />
                        )}
                        <View style={styles.commentTextContainer}>
                          <Text style={styles.commentAuthor}>{comment.user?.display_name}</Text>
                          <Text style={styles.commentText}>{comment.text}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <View style={styles.commentInputContainer}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment..."
                  value={newComment}
                  onChangeText={setNewComment}
                />
                <TouchableOpacity 
                   onPress={handleAddComment}
                   disabled={socialLoading || !newComment.trim()}
                >
                  <Text style={[styles.postCommentBtn, !newComment.trim() && { opacity: 0.5 }]}>Post</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#eef2ff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#6366f1',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  addPostBtn: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  modalBody: {
    flex: 1,
  },
  mediaPlaceholder: {
    width: '100%',
    aspectRatio: 4/3,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  mediaPlaceholderText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 15,
  },
  previewContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  postTextInput: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchResults: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  searchItemText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  modalFooter: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  detailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  detailContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  authorName: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#1e293b',
  },
  authorLocation: {
    fontSize: 12,
    color: '#6366f1',
  },
  detailMedia: {
    width: '100%',
    aspectRatio: 1,
  },
  detailInfo: {
    padding: 16,
  },
  socialActions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  socialBtn: {
    padding: 4,
  },
  detailText: {
    fontSize: 15,
    color: '#1e293b',
    lineHeight: 20,
    marginBottom: 20,
  },
  commentsSection: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16,
  },
  commentsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 12,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentTextContainer: {
    flex: 1,
  },
  commentAuthor: {
    fontWeight: 'bold',
    fontSize: 13,
    color: '#1e293b',
  },
  commentText: {
    fontSize: 13,
    color: '#475569',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
  },
  postCommentBtn: {
    color: '#6366f1',
    fontWeight: 'bold',
    fontSize: 14,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 40,
  },
  postItem: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  postMedia: {
    width: '100%',
    height: '100%',
  },
  postTextOnly: {
    flex: 1,
    padding: 8,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
  },
  postTextPreview: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
  },
  videoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyGrid: {
    width: '100%',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGridText: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 14,
  },
});
