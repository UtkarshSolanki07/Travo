import { View, Text, Image, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getAvatarUrl } from '@/lib/cloudinary'
import { User } from '@/services/database'

interface ProfileHeaderProps {
  userData: User | null
  friendsCount: number
  activitiesCount: number
  isEditing: boolean
  onEditPress: () => void
  onCreatePostPress: () => void
  onAvatarPress?: () => void
  editingData?: Partial<User>
}

/**
 * Render a user's profile header with avatar, basic info, social counts, and action buttons; switches into an avatar-focused edit presentation when editing.
 *
 * @param userData - The current persisted user data to display when not editing; may be null.
 * @param friendsCount - Number of friends to show in the stats card.
 * @param activitiesCount - Number of activities to show in the stats card.
 * @param isEditing - When true, the header shows the editing state (avatar editable and other profile details hidden).
 * @param onEditPress - Callback invoked when the "Edit Profile" button is pressed.
 * @param onCreatePostPress - Callback invoked when the "Add Post" button is pressed.
 * @param onAvatarPress - Optional callback invoked when the avatar is pressed while in editing mode.
 * @param editingData - Optional partial user data used to preview changes while editing.
 * @returns The rendered profile header element.
 */
export default function ProfileHeader({
  userData,
  friendsCount,
  activitiesCount,
  isEditing,
  onEditPress,
  onCreatePostPress,
  onAvatarPress,
  editingData
}: ProfileHeaderProps) {
  const displayData = isEditing ? editingData : userData

  return (
    <View className="items-center mb-8">
      <TouchableOpacity 
        onPress={isEditing ? onAvatarPress : undefined}
        className="relative mb-4"
      >
        <View className="p-1 bg-white rounded-full shadow-md w-[110px] h-[110px] justify-center items-center overflow-hidden">
          {displayData?.avatar_url ? (
            <Image 
              source={{ uri: getAvatarUrl(displayData.avatar_url, 200) }} 
              className="w-[100px] h-[100px] rounded-full" 
            />
          ) : (
            <Ionicons name="person-circle" size={100} color="#6366f1" />
          )}
        </View>
        {isEditing && (
          <View className="absolute bottom-1 right-1 bg-indigo-500 w-8 h-8 rounded-full justify-center items-center border-2 border-white">
            <Ionicons name="camera" size={20} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
      
      {!isEditing && (
        <>
          <Text className="text-2xl font-bold text-slate-800 text-center">
            {userData?.display_name || userData?.username || 'Traveler'}
          </Text>
          <Text className="text-[15px] text-slate-500 mt-1">
            {userData?.city ? `${userData.city}, ` : ''}{userData?.country || 'No location set'}
          </Text>
          {userData?.bio && (
            <Text className="text-sm text-slate-600 text-center mt-3 px-5 leading-5">
              {userData.bio}
            </Text>
          )}
          
          <View className="flex-row items-center justify-center mt-6 bg-white py-3 px-6 rounded-2xl border border-slate-100">
            <View className="items-center px-5">
              <Text className="text-xl font-bold text-slate-800">{friendsCount}</Text>
              <Text className="text-xs text-slate-500 mt-0.5 uppercase tracking-wide">Friends</Text>
            </View>
            <View className="w-px h-[30px] bg-slate-200" />
            <View className="items-center px-5">
              <Text className="text-xl font-bold text-slate-800">{activitiesCount}</Text>
              <Text className="text-xs text-slate-500 mt-0.5 uppercase tracking-wide">Activities</Text>
            </View>
          </View>
          
          <View className="flex-row gap-3 mt-3">
            <TouchableOpacity 
              className="flex-row items-center mt-3 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-200"
              onPress={onEditPress}
            >
              <Ionicons name="create-outline" size={16} color="#6366f1" />
              <Text className="ml-1.5 text-indigo-500 font-semibold text-sm">Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              className="flex-row items-center mt-3 px-4 py-2 rounded-full bg-indigo-500 border border-indigo-500"
              onPress={onCreatePostPress}
            >
              <Ionicons name="add-circle-outline" size={16} color="#fff" />
              <Text className="ml-1.5 text-white font-semibold text-sm">Add Post</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  )
}