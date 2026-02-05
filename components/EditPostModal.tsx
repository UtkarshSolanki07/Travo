import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { VideoView } from 'expo-video'
import { Post } from '@/services/database'
import { getOptimizedUrl } from '@/lib/cloudinary'

interface EditPostModalProps {
  visible: boolean
  post: Post | null
  postText: string
  postMedia: { uri: string, type: 'image' | 'video' } | null
  venueName: string
  locationName: string
  venueResults: any[]
  locationResults: any[]
  isSearchingVenue: boolean
  isSearchingLocation: boolean
  updating: boolean
  videoPlayer: any
  onClose: () => void
  onPostTextChange: (text: string) => void
  onPickMedia: () => void
  onRemoveMedia: () => void
  onVenueSearch: (query: string) => void
  onLocationSearch: (query: string) => void
  onSelectVenue: (place: any) => void
  onSelectLocation: (place: any) => void
  onUpdatePost: () => void
}

/**
 * Renders a modal sheet for editing a post, including media preview/selection, post text, venue and location search with selectable results, and an update action.
 *
 * @param visible - Controls modal visibility
 * @param post - Existing post object; used to display existing media when present
 * @param postText - Current post text value
 * @param postMedia - Newly selected media preview (image or video) for the post
 * @param venueName - Current venue search text
 * @param locationName - Current location search text
 * @param venueResults - Array of venue search results displayed for selection
 * @param locationResults - Array of location search results displayed for selection
 * @param isSearchingVenue - Whether venue search is in progress (shows activity indicator)
 * @param isSearchingLocation - Whether location search is in progress (shows activity indicator)
 * @param updating - Whether the post update operation is in progress (disables update button and shows loader)
 * @param videoPlayer - Reference passed to the video player used for video previews
 * @param onClose - Called to close the modal
 * @param onPostTextChange - Called with new text when the post content changes
 * @param onPickMedia - Called to initiate media selection
 * @param onRemoveMedia - Called to remove currently selected or existing media
 * @param onVenueSearch - Called with new venue query text
 * @param onLocationSearch - Called with new location query text
 * @param onSelectVenue - Called with a venue result when the user selects one
 * @param onSelectLocation - Called with a location result when the user selects one
 * @param onUpdatePost - Called to submit the updated post
 *
 * @returns The rendered Edit Post modal React element
 */
export default function EditPostModal({
  visible,
  post,
  postText,
  postMedia,
  venueName,
  locationName,
  venueResults,
  locationResults,
  isSearchingVenue,
  isSearchingLocation,
  updating,
  videoPlayer,
  onClose,
  onPostTextChange,
  onPickMedia,
  onRemoveMedia,
  onVenueSearch,
  onLocationSearch,
  onSelectVenue,
  onSelectLocation,
  onUpdatePost
}: EditPostModalProps) {
  const existingMediaUrl = post?.media_url
  const existingMediaType = post?.media_type

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-black/50 justify-end"
      >
        <View className="bg-white rounded-t-3xl h-[80%] p-6">
          <View className="flex-row justify-between items-center mb-5">
            <Text className="text-xl font-bold text-slate-800">Edit Post</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1">
            <TouchableOpacity 
              className="w-full aspect-[4/3] bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 justify-center items-center mb-5 overflow-hidden"
              onPress={onPickMedia}
            >
              {postMedia ? (
                <View className="w-full h-full relative">
                  {postMedia.type === 'video' ? (
                    <VideoView
                      style={{ width: '100%', height: '100%' }}
                      player={videoPlayer}
                      allowsFullscreen
                      allowsPictureInPicture
                      nativeControls
                    />
                  ) : (
                    <Image source={{ uri: postMedia.uri }} className="w-full h-full" />
                  )}
                  <TouchableOpacity 
                    className="absolute top-2.5 right-2.5 bg-white rounded-xl"
                    onPress={onRemoveMedia}
                  >
                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ) : existingMediaUrl ? (
                <View className="w-full h-full relative">
                  {existingMediaType === 'video' ? (
                    <VideoView
                      style={{ width: '100%', height: '100%' }}
                      player={videoPlayer}
                      allowsFullscreen
                      allowsPictureInPicture
                      nativeControls
                    />
                  ) : (
                    <Image 
                      source={{ uri: getOptimizedUrl(existingMediaUrl, { width: 800 }) }} 
                      className="w-full h-full" 
                    />
                  )}
                  <TouchableOpacity 
                    className="absolute top-2.5 right-2.5 bg-white rounded-xl"
                    onPress={onRemoveMedia}
                  >
                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                  </TouchableOpacity>
                  <View className="absolute bottom-2.5 left-2.5 bg-black/60 px-3 py-1.5 rounded-lg">
                    <Text className="text-white text-xs">Tap to change</Text>
                  </View>
                </View>
              ) : (
                <>
                  <Ionicons name="image-outline" size={48} color="#94a3b8" />
                  <Text className="mt-3 text-slate-500 text-[15px]">Add Photo or Video</Text>
                </>
              )}
            </TouchableOpacity>

            <TextInput
              className="bg-white border border-slate-200 rounded-xl p-3 mb-3 text-base text-slate-800 h-[120px]"
              placeholder="What's on your mind?..."
              multiline
              textAlignVertical="top"
              value={postText}
              onChangeText={onPostTextChange}
            />

            <View className="flex-row items-center bg-slate-50 rounded-xl px-3 border border-slate-200">
              <Ionicons name="location-outline" size={20} color="#6366f1" />
              <TextInput
                className="flex-1 p-3 text-base"
                placeholder="Place (e.g. Starburst Cafe, Eiffel Tower)"
                value={venueName}
                onChangeText={onVenueSearch}
              />
              {isSearchingVenue && <ActivityIndicator size="small" color="#6366f1" />}
            </View>

            {venueResults.length > 0 && (
              <View className="bg-white rounded-xl mt-1 border border-slate-200 overflow-hidden">
                {venueResults.map((item, index) => (
                  <TouchableOpacity 
                    key={index} 
                    className="flex-row items-center p-3 border-b border-slate-100 gap-2.5"
                    onPress={() => onSelectVenue(item)}
                  >
                    <Ionicons name="pin-outline" size={16} color="#64748b" />
                    <Text className="text-[13px] text-slate-600 flex-1" numberOfLines={1}>
                      {item.place_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View className="flex-row items-center bg-slate-50 rounded-xl px-3 border border-slate-200 mt-3">
              <Ionicons name="globe-outline" size={20} color="#6366f1" />
              <TextInput
                className="flex-1 p-3 text-base"
                placeholder="Search location..."
                value={locationName}
                onChangeText={onLocationSearch}
              />
              {isSearchingLocation && <ActivityIndicator size="small" color="#6366f1" />}
            </View>

            {locationResults.length > 0 && (
              <View className="bg-white rounded-xl mt-1 border border-slate-200 overflow-hidden">
                {locationResults.map((item, index) => (
                  <TouchableOpacity 
                    key={index} 
                    className="flex-row items-center p-3 border-b border-slate-100 gap-2.5"
                    onPress={() => onSelectLocation(item)}
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
              className="bg-indigo-500 p-3.5 rounded-xl items-center"
              onPress={onUpdatePost}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold">Update Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}