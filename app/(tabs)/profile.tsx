import { SignedIn, SignedOut, useUser } from '@clerk/clerk-expo'
import { Link } from 'expo-router'
import { Text, View, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Image, Alert, Dimensions, Modal, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useState, useEffect, useCallback, useRef } from 'react'
import * as Location from 'expo-location'
import { useLocationContext } from '@/context/LocationContext'
import { database, User, Post, PostComment } from '@/services/database'
import { uploadToCloudinary, getAvatarUrl, getOptimizedUrl, getVideoThumbUrl } from '@/lib/cloudinary'
import { searchVenues, searchLocations } from '@/services/googlemaps'
import debounce from 'lodash.debounce'

// Removed local global.css import as it's now in _layout.tsx

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
      const city = place.context?.city || ''
      const country = place.context?.country || ''
      
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
    } catch {
       Alert.alert('Error', 'Failed to add comment')
    } finally {
      setSocialLoading(false)
    }
  }

  if (clerkUser && loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="p-6 pt-[60px]">
      <SignedIn>
        {/* Header Section */}
        <View className="items-center mb-8">
          <TouchableOpacity 
            onPress={isEditing ? pickImage : undefined}
            className="relative mb-4"
          >
            <View className="p-1 bg-white rounded-full w-[110px] h-[110px] items-center justify-center overflow-hidden shadow-sm">
              {editingData.avatar_url || userData?.avatar_url ? (
                <Image 
                  source={{ uri: getAvatarUrl(editingData.avatar_url || userData?.avatar_url, 200) }} 
                  className="w-[100px] h-[100px] rounded-full"
                />
              ) : (
                <Ionicons name="person-circle" size={100} color="#6366f1" />
              )}
            </View>
            {isEditing && (
              <View className="absolute bottom-[5px] right-[5px] bg-indigo-500 w-8 h-8 rounded-full items-center justify-center border-2 border-white">
                <Ionicons name="camera" size={20} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          
          {isEditing ? (
              <View className="w-full px-2.5">
              <TextInput
                className="bg-white border border-slate-200 rounded-xl p-3 mb-3 text-base text-slate-800"
                placeholder="Display Name"
                value={editingData.display_name || ''}
                onChangeText={(text: string) => setEditingData({ ...editingData, display_name: text })}
              />
              <TextInput
                className="bg-white border border-slate-200 rounded-xl p-3 mb-3 text-base text-slate-800 h-20 text-top"
                placeholder="Bio"
                multiline
                numberOfLines={3}
                value={editingData.bio || ''}
                onChangeText={(text: string) => setEditingData({ ...editingData, bio: text })}
              />
              <View className="flex-row mb-3">
                <TextInput
                  className="bg-white border border-slate-200 rounded-xl p-3 text-base text-slate-800 flex-1 mr-2"
                  placeholder="City"
                  value={editingData.city || ''}
                  onChangeText={(text: string) => setEditingData({ ...editingData, city: text })}
                />
                <TextInput
                  className="bg-white border border-slate-200 rounded-xl p-3 text-base text-slate-800 flex-1"
                  placeholder="Country"
                  value={editingData.country || ''}
                  onChangeText={(text: string) => setEditingData({ ...editingData, country: text })}
                />
              </View>
              <View className="flex-row gap-3 mt-2">
                <TouchableOpacity 
                  className="flex-1 py-3.5 rounded-xl items-center bg-slate-100" 
                  onPress={() => {
                    setIsEditing(false)
                    setEditingData(userData || {})
                  }}
                >
                  <Text className="text-slate-600 font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className="flex-1 py-3.5 rounded-xl items-center bg-indigo-500" 
                  onPress={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text className="text-2xl font-bold text-slate-800 text-center">{userData?.display_name || userData?.username || 'Traveler'}</Text>
              <Text className="text-[15px] text-slate-500 mt-1">
                {userData?.city ? `${userData.city}, ` : ''}{userData?.country || 'No location set'}
              </Text>
              {userData?.bio && (
                <Text className="text-sm text-slate-600 text-center mt-3 px-5 leading-5">{userData.bio}</Text>
              )}
              
              {/* Stats Section */}
              <View className="flex-row items-center justify-center mt-6 bg-white py-3 px-6 rounded-2xl border border-slate-100">
                <View className="items-center px-5">
                  <Text className="text-xl font-bold text-slate-800">{friendsCount}</Text>
                  <Text className="text-xs text-slate-500 mt-0.5 uppercase tracking-wide">Friends</Text>
                </View>
                <View className="w-[1px] h-[30px] bg-slate-200" />
                <View className="items-center px-5">
                  <Text className="text-xl font-bold text-slate-800">{activitiesCount}</Text>
                  <Text className="text-xs text-slate-500 mt-0.5 uppercase tracking-wide">Activities</Text>
                </View>
              </View>
              
              <View className="flex-row gap-3 mt-3">
                <TouchableOpacity 
                  className="flex-row items-center mt-3 px-4 py-2 rounded-[20px] bg-indigo-50 border border-indigo-100"
                  onPress={() => setIsEditing(true)}
                >
                  <Ionicons name="create-outline" size={16} color="#6366f1" />
                  <Text className="ml-1.5 text-indigo-500 font-semibold text-sm">Edit Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  className="flex-row items-center mt-3 px-4 py-2 rounded-[20px] bg-indigo-500 border border-indigo-500"
                  onPress={() => setIsCreatingPost(true)}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#fff" />
                  <Text className="ml-1.5 text-white font-semibold text-sm">Add Post</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Posts Section */}
        <View className="flex-row mb-4 bg-white rounded-2xl p-1.5 border border-slate-100">
          <TouchableOpacity 
            className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl gap-2 ${activeTab === 'posts' ? 'bg-indigo-50' : ''}`}
            onPress={() => setActiveTab('posts')}
          >
            <Ionicons 
              name="grid-outline" 
              size={20} 
              color={activeTab === 'posts' ? '#6366f1' : '#64748b'} 
            />
            <Text className={`text-sm font-semibold ${activeTab === 'posts' ? 'text-indigo-500' : 'text-slate-500'}`}>My Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl gap-2 ${activeTab === 'tagged' ? 'bg-indigo-50' : ''}`}
            onPress={() => setActiveTab('tagged')}
          >
            <Ionicons 
              name="people-outline" 
              size={20} 
              color={activeTab === 'tagged' ? '#6366f1' : '#64748b'} 
            />
            <Text className={`text-sm font-semibold ${activeTab === 'tagged' ? 'text-indigo-500' : 'text-slate-500'}`}>Tagged</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row flex-wrap gap-2 mb-10">
          {postsLoading ? (
            <ActivityIndicator style={{ padding: 40 }} color="#6366f1" />
          ) : (
            (activeTab === 'posts' ? myPosts : taggedPosts).length > 0 ? (
              (activeTab === 'posts' ? myPosts : taggedPosts).map((post) => (
                <TouchableOpacity 
                  key={post.id} 
                  style={{ width: COLUMN_WIDTH, height: COLUMN_WIDTH }}
                  className="rounded-xl overflow-hidden bg-white border border-slate-100"
                  onPress={() => openPostDetail(post)}
                >
                  {post.media_url ? (
                    <Image 
                      source={{ 
                        uri: post.media_type === 'video' 
                          ? getVideoThumbUrl(post.media_url, { width: 300, height: 300 })
                          : getOptimizedUrl(post.media_url, { width: 300, height: 300 })
                      }} 
                      className="w-full h-full"
                    />
                  ) : (
                    <View className="flex-1 p-2 bg-slate-50 justify-center">
                      <Text numberOfLines={3} className="text-[10px] text-slate-500 text-center">{post.text}</Text>
                    </View>
                  )}
                  {post.media_type === 'video' && (
                    <View className="absolute top-1.5 right-1.5 bg-black/40 w-6 h-6 rounded-full items-center justify-center">
                      <Ionicons name="play" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <View className="w-full p-10 items-center justify-center">
                <Ionicons 
                  name={activeTab === 'posts' ? "images-outline" : "person-add-outline"} 
                  size={48} 
                  color="#e2e8f0" 
                />
                <Text className="mt-3 text-slate-400 text-sm">
                  {activeTab === 'posts' ? "No posts yet" : "No tagged posts"}
                </Text>
              </View>
            )
          )}
        </View>

        {/* Interests Section */}
        <View className="bg-white rounded-[20px] p-5 mb-5 shadow-sm">
          <Text className="text-lg font-semibold text-slate-800 mb-4">Interests</Text>
          
          <View className="flex-row gap-2.5 mb-4">
            <TextInput
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[15px]"
              placeholder="Add your own interest..."
              value={customInterest}
              onChangeText={setCustomInterest}
              onSubmitEditing={addCustomInterest}
            />
            <TouchableOpacity 
              className="bg-indigo-500 w-11 h-11 rounded-xl items-center justify-center"
              onPress={addCustomInterest}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <View className="flex-row flex-wrap gap-2.5">
            {/* Show selected interests first (especially custom ones) */}
            {selectedInterests.map(interest => (
              <TouchableOpacity 
                key={interest}
                className="px-3.5 py-2 rounded-[20px] bg-indigo-500 border border-indigo-500"
                onPress={() => toggleInterest(interest)}
              >
                <Text className="text-white font-medium">
                  {interest}
                </Text>
              </TouchableOpacity>
            ))}
            
            {/* Show available preset interests that aren't selected */}
            {INITIAL_INTERESTS.filter(i => !selectedInterests.includes(i)).map(interest => (
              <TouchableOpacity 
                key={interest}
                className="px-3.5 py-2 rounded-[20px] bg-slate-100 border border-slate-200"
                onPress={() => toggleInterest(interest)}
              >
                <Text className="text-sm text-slate-600">
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
            className="flex-1 bg-black/50 justify-end"
          >
            <View className="bg-white rounded-t-[24px] h-[80%] p-6">
              <View className="flex-row justify-between items-center mb-5">
                <Text className="text-xl font-bold text-slate-800">Create New Post</Text>
                <TouchableOpacity onPress={() => setIsCreatingPost(false)}>
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView className="flex-1">
                <TouchableOpacity 
                  className="w-full aspect-[4/3] bg-slate-100 rounded-2xl border-2 border-slate-200 border-dashed items-center justify-center mb-5 overflow-hidden" 
                  onPress={pickPostMedia}
                >
                  {postMedia ? (
                    <View className="w-full h-full relative">
                      <Image source={{ uri: postMedia.uri }} className="w-full h-full" />
                      <TouchableOpacity 
                        className="absolute top-2.5 right-2.5 bg-white rounded-xl"
                        onPress={() => setPostMedia(null)}
                      >
                        <Ionicons name="close-circle" size={24} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <Ionicons name="image-outline" size={48} color="#94a3b8" />
                      <Text className="mt-3 text-slate-500 text-[15px]">Add Photo or Video</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TextInput
                  className="bg-white border border-slate-200 rounded-xl p-3 mb-3 text-base text-slate-800 h-[120px] text-top pt-3"
                  placeholder="What's on your mind?..."
                  multiline
                  value={postText}
                  onChangeText={setPostText}
                />

                <View className="flex-row items-center bg-slate-50 rounded-xl px-3 border border-slate-200 mb-0">
                  <Ionicons name="location-outline" size={20} color="#6366f1" />
                  <TextInput
                    className="flex-1 text-base text-slate-800 p-3"
                    placeholder="Place (e.g. Starburst Cafe, Eiffel Tower)"
                    value={venueName}
                    onChangeText={handleSearchVenue}
                  />
                  {isSearchingVenue && <ActivityIndicator size="small" color="#6366f1" />}
                </View>

                {venueResults.length > 0 && (
                  <View className="bg-white rounded-xl mt-1 border border-slate-200 overflow-hidden">
                    {venueResults.map((item, index) => (
                      <TouchableOpacity 
                        key={index} 
                        className="flex-row items-center p-3 border-b border-slate-100 gap-2.5"
                        onPress={() => selectVenue(item)}
                      >
                        <Ionicons name="pin-outline" size={16} color="#64748b" />
                        <Text className="text-[13px] text-slate-600 flex-1" numberOfLines={1}>
                          {item.place_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View className="flex-row items-center bg-slate-50 rounded-xl px-3 border border-slate-200 mt-3 mb-0">
                  <Ionicons name="globe-outline" size={20} color="#6366f1" />
                  <TextInput
                    className="flex-1 text-base text-slate-800 p-3"
                    placeholder="Search location..."
                    value={locationName}
                    onChangeText={handleSearchLocation}
                  />
                  {isSearchingLocation && <ActivityIndicator size="small" color="#6366f1" />}
                </View>

                {locationResults.length > 0 && (
                  <View className="bg-white rounded-xl mt-1 border border-slate-200 overflow-hidden">
                    {locationResults.map((item, index) => (
                      <TouchableOpacity 
                        key={index} 
                        className="flex-row items-center p-3 border-b border-slate-100 gap-2.5"
                        onPress={() => selectLocation(item)}
                      >
                        <Ionicons name="map-outline" size={16} color="#64748b" />
                        <Text className="text-[13px] text-slate-600 flex-1" numberOfLines={1}>
                          {item.place_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </ScrollView>

              <View className="pt-5 border-t border-slate-100">
                <TouchableOpacity 
                  className="flex-1 py-3.5 rounded-xl items-center bg-indigo-500"
                  onPress={handleCreatePost}
                  disabled={creating}
                >
                  {creating ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Share Post</Text>}
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
          <View className="flex-1 bg-black/80 justify-center p-5">
            <View className="bg-white rounded-[20px] max-h-[90%] overflow-hidden">
              <View className="flex-row justify-between items-center p-4 border-b border-slate-100">
                <View className="flex-row items-center gap-3">
                  {selectedPost?.user?.avatar_url ? (
                    <Image 
                      source={{ uri: getAvatarUrl(selectedPost.user.avatar_url, 80) }} 
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <Ionicons name="person-circle" size={40} color="#6366f1" />
                  )}
                  <View>
                    <Text className="font-bold text-base text-slate-800">{selectedPost?.user?.display_name || 'User'}</Text>
                    {selectedPost?.location_name && (
                      <Text className="text-xs text-indigo-500">{selectedPost.location_name}</Text>
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
                    className="w-full aspect-square"
                  />
                )}
                
                <View className="p-4">
                  <View className="flex-row gap-4 mb-3">
                    <TouchableOpacity onPress={handleToggleLike} className="p-1">
                      <Ionicons 
                        name={selectedPost?.is_liked ? "heart" : "heart-outline"} 
                        size={28} 
                        color={selectedPost?.is_liked ? "#ef4444" : "#64748b"} 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity className="p-1">
                      <Ionicons name="chatbubble-outline" size={26} color="#64748b" />
                    </TouchableOpacity>
                  </View>

                  {selectedPost?.text && (
                    <Text className="text-[15px] text-slate-800 leading-5 mb-5">
                      <Text style={{ fontWeight: 'bold' }}>{selectedPost?.user?.display_name} </Text>
                      {selectedPost.venue_name && <Text className="text-indigo-500 font-semibold">at {selectedPost.venue_name} </Text>}
                      {selectedPost.text}
                    </Text>
                  )}

                  <View className="border-t border-slate-100 pt-4">
                    <Text className="text-sm font-semibold text-slate-500 mb-3">Comments</Text>
                    {comments.map(comment => (
                      <View key={comment.id} className="flex-row gap-2.5 mb-3">
                        {comment.user?.avatar_url ? (
                          <Image source={{ uri: getAvatarUrl(comment.user.avatar_url, 60) }} className="w-8 h-8 rounded-full" />
                        ) : (
                          <Ionicons name="person-circle" size={32} color="#94a3b8" />
                        )}
                        <View className="flex-1">
                          <Text className="font-bold text-[13px] text-slate-800">{comment.user?.display_name}</Text>
                          <Text className="text-[13px] text-slate-600">{comment.text}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <View className="flex-row items-center p-3 border-t border-slate-100 gap-3">
                <TextInput
                  className="flex-1 bg-slate-50 rounded-[20px] px-4 py-2 text-sm"
                  placeholder="Add a comment..."
                  value={newComment}
                  onChangeText={setNewComment}
                />
                <TouchableOpacity 
                   onPress={handleAddComment}
                   disabled={socialLoading || !newComment.trim()}
                >
                  <Text className={`text-indigo-500 font-bold text-sm ${!newComment.trim() ? 'opacity-50' : ''}`}>Post</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SignedIn>

      <SignedOut>
        <View className="flex-1 items-center justify-center mt-[100px]">
          <Ionicons name="lock-closed" size={60} color="#64748b" />
          <Text className="text-2xl font-bold text-slate-800 mt-4">You are not signed in</Text>
          <Text className="text-base text-slate-500 text-center mt-2 mb-8 px-4">Sign in to customize your profile and share your journey.</Text>
          <View className="w-full gap-4">
            <Link href="./(auth)/sign-in" className="bg-indigo-500 p-4 rounded-xl items-center text-center">
              <Text className="text-white font-bold">Sign in</Text>
            </Link>
            <Link href="./(auth)/sign-up" className="bg-white p-4 rounded-xl items-center text-center border border-indigo-500">
              <Text className="text-indigo-500 font-bold">Sign up</Text>
            </Link>
          </View>
        </View>
      </SignedOut>
    </ScrollView>
  )
}
