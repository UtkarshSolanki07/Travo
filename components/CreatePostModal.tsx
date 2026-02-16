import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface PlaceResult {
  place_name: string;
  text?: string;
  context?: { id: string; text: string }[];
  // Add other fields as needed
}

interface CreatePostModalProps {
  visible: boolean;
  postText: string;
  postMedia: { uri: string; type: "image" | "video" } | null;
  venueName: string;
  locationName: string;
  venueResults: PlaceResult[];
  locationResults: PlaceResult[];
  isSearchingVenue: boolean;
  isSearchingLocation: boolean;
  creating: boolean;
  videoPlayer: ReturnType<typeof useVideoPlayer> | null;
  onClose: () => void;
  onPostTextChange: (text: string) => void;
  onPickMedia: () => void;
  onRemoveMedia: () => void;
  onVenueSearch: (query: string) => void;
  onLocationSearch: (query: string) => void;
  postCity?: string;
  postCountry?: string;
  visibility: "public" | "friends";
  onVisibilityChange: (value: "public" | "friends") => void;
  onSelectVenue: (place: PlaceResult) => void;
  onSelectLocation: (place: PlaceResult) => void;
  onCreatePost: () => void;
}

/**
 * Render a modal UI for composing and sharing a new post.
 *
 * Renders media picker (image or video), post text input, visibility toggles, venue/location search with results,
 * optional city/country pill, and a footer action to publish the post.
 *
 * @param visible - Controls whether the modal is shown
 * @param postMedia - Selected media to attach, or `null`. Shape: `{ uri: string; type: "image" | "video" }`
 * @param videoPlayer - Video player controller returned from `useVideoPlayer`, used when rendering a video; may be `null`
 * @param postCity - Optional city name to display in the location pill
 * @param postCountry - Optional country name to display in the location pill
 * @param visibility - Current post visibility, either `"public"` or `"friends"`
 * @param onVisibilityChange - Callback invoked with the new visibility value
 * @param onPickMedia - Callback to open media picker
 * @param onRemoveMedia - Callback to remove the currently selected media
 * @param onVenueSearch - Callback called with the venue search query
 * @param onLocationSearch - Callback called with the location search query
 * @param onSelectVenue - Callback invoked with a selected `PlaceResult` from venueResults
 * @param onSelectLocation - Callback invoked with a selected `PlaceResult` from locationResults
 * @param onCreatePost - Callback invoked to publish the post
 * @returns The JSX element for the create-post modal
 */
export default function CreatePostModal({
  visible,
  postText,
  postMedia,
  venueName,
  locationName,
  venueResults,
  locationResults,
  isSearchingVenue,
  isSearchingLocation,
  creating,
  videoPlayer,
  postCity,
  postCountry,
  visibility,
  onVisibilityChange,
  onClose,
  onPostTextChange,
  onPickMedia,
  onRemoveMedia,
  onVenueSearch,
  onLocationSearch,
  onSelectVenue,
  onSelectLocation,
  onCreatePost,
}: CreatePostModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-black/50 justify-end"
      >
        <View className="bg-white rounded-t-3xl h-[80%] p-6">
          <View className="flex-row justify-between items-center mb-5">
            <Text className="text-xl font-bold text-slate-800">
              Create New Post
            </Text>
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
                  {postMedia.type === "video" ? (
                    videoPlayer && (
                      <VideoView
                        style={{ width: "100%", height: "100%" }}
                        player={videoPlayer}
                        allowsFullscreen
                        allowsPictureInPicture
                        nativeControls
                      />
                    )
                  ) : (
                    <Image
                      source={{ uri: postMedia.uri }}
                      className="w-full h-full"
                    />
                  )}
                  <TouchableOpacity
                    className="absolute top-2.5 right-2.5 bg-white rounded-xl"
                    onPress={onRemoveMedia}
                  >
                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Ionicons name="image-outline" size={48} color="#94a3b8" />
                  <Text className="mt-3 text-slate-500 text-[15px]">
                    Add Photo or Video
                  </Text>
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

            <View className="flex-row items-center mb-4 px-1 gap-4">
              <TouchableOpacity
                onPress={() => onVisibilityChange("public")}
                className={`flex-row items-center px-4 py-2 rounded-full border ${visibility === "public" ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200"}`}
              >
                <Ionicons
                  name="globe-outline"
                  size={14}
                  color={visibility === "public" ? "#6366f1" : "#64748b"}
                />
                <Text
                  className={`text-[12px] font-medium ml-1.5 ${visibility === "public" ? "text-indigo-600" : "text-slate-500"}`}
                >
                  Public
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onVisibilityChange("friends")}
                className={`flex-row items-center px-4 py-2 rounded-full border ${visibility === "friends" ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200"}`}
              >
                <Ionicons
                  name="people-outline"
                  size={14}
                  color={visibility === "friends" ? "#6366f1" : "#64748b"}
                />
                <Text
                  className={`text-[12px] font-medium ml-1.5 ${visibility === "friends" ? "text-indigo-600" : "text-slate-500"}`}
                >
                  Friends
                </Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center bg-slate-50 rounded-xl px-3 border border-slate-200">
              <Ionicons name="location-outline" size={20} color="#6366f1" />
              <TextInput
                className="flex-1 p-3 text-base"
                placeholder="Place (e.g. Starburst Cafe, Eiffel Tower)"
                value={venueName}
                onChangeText={onVenueSearch}
              />
              {isSearchingVenue && (
                <ActivityIndicator size="small" color="#6366f1" />
              )}
            </View>

            {(postCity || postCountry) && (
              <View className="flex-row items-center mt-2 px-1">
                <View className="bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 flex-row items-center">
                  <Ionicons name="map-outline" size={12} color="#6366f1" />
                  <Text className="text-[11px] text-indigo-600 font-medium ml-1">
                    {[postCity, postCountry].filter(Boolean).join(", ")}
                  </Text>
                </View>
              </View>
            )}

            {venueResults.length > 0 && (
              <View className="bg-white rounded-xl mt-1 border border-slate-200 overflow-hidden">
                {venueResults.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    className="flex-row items-center p-3 border-b border-slate-100 gap-2.5"
                    onPress={() => onSelectVenue(item)}
                  >
                    <Ionicons name="pin-outline" size={16} color="#64748b" />
                    <View className="flex-1">
                      <Text
                        className="text-[14px] font-semibold text-slate-800"
                        numberOfLines={1}
                      >
                        {item.text}
                      </Text>
                      <Text
                        className="text-[11px] text-slate-500"
                        numberOfLines={1}
                      >
                        {item.place_name}
                      </Text>
                    </View>
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
              {isSearchingLocation && (
                <ActivityIndicator size="small" color="#6366f1" />
              )}
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
                    <View className="flex-1">
                      <Text
                        className="text-[14px] font-semibold text-slate-800"
                        numberOfLines={1}
                      >
                        {item.text}
                      </Text>
                      <Text
                        className="text-[11px] text-slate-500"
                        numberOfLines={1}
                      >
                        {item.place_name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          <View className="pt-5 border-t border-slate-100">
            <TouchableOpacity
              className="bg-indigo-500 p-3.5 rounded-xl items-center"
              onPress={onCreatePost}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold">Share Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}