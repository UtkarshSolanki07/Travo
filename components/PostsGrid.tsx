import { View, Text, TouchableOpacity, Image, ActivityIndicator, Dimensions } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Post } from '@/services/database'
import { getOptimizedUrl, getVideoThumbUrl } from '@/lib/cloudinary'

const { width } = Dimensions.get('window')
const COLUMN_WIDTH = (width - 64) / 3

interface PostsGridProps {
  posts: Post[]
  loading: boolean
  emptyMessage: string
  emptyIcon: string
  onPostPress: (post: Post) => void
}

export default function PostsGrid({
  posts,
  loading,
  emptyMessage,
  emptyIcon,
  onPostPress
}: PostsGridProps) {
  if (loading) {
    return (
      <View className="p-10">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    )
  }

  if (posts.length === 0) {
    return (
      <View className="w-full p-10 items-center justify-center">
        <Ionicons name={emptyIcon as any} size={48} color="#e2e8f0" />
        <Text className="mt-3 text-slate-400 text-sm">{emptyMessage}</Text>
      </View>
    )
  }

  return (
    <View className="flex-row flex-wrap gap-2 mb-10">
      {posts.map((post) => (
        <TouchableOpacity 
          key={post.id} 
          style={{ width: COLUMN_WIDTH, height: COLUMN_WIDTH }}
          className="rounded-xl overflow-hidden bg-white border border-slate-100"
          onPress={() => onPostPress(post)}
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
              <Text numberOfLines={3} className="text-[10px] text-slate-500 text-center">
                {post.text}
              </Text>
            </View>
          )}
          {post.media_type === 'video' && (
            <View className="absolute top-1.5 right-1.5 bg-black/40 w-6 h-6 rounded-xl justify-center items-center">
              <Ionicons name="play" size={14} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  )
}