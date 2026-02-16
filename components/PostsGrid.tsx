import { getOptimizedUrl, getVideoThumbUrl } from "@/lib/cloudinary";
import { Post } from "@/services/database";
import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const { width } = Dimensions.get("window");
const COLUMN_WIDTH = (width - 64) / 3;

interface PostsGridProps {
  posts: Post[];
  loading: boolean;
  emptyMessage: string;
  emptyIcon: ComponentProps<typeof Ionicons>["name"];
  onPostPress: (post: Post) => void;
}

/**
 * Render a responsive three-column grid of posts, showing thumbnails for media, a text fallback, and dedicated loading and empty states.
 *
 * @param posts - Array of Post objects to display in the grid.
 * @param loading - When true, displays a centered activity indicator instead of the grid.
 * @param emptyMessage - Message shown when `posts` is empty and not loading.
 * @param emptyIcon - Ionicons icon name shown above the empty message.
 * @param onPostPress - Callback invoked with a Post when a tile is pressed.
 * @returns The rendered React element for the posts grid.
 */
export default function PostsGrid({
  posts,
  loading,
  emptyMessage,
  emptyIcon,
  onPostPress,
}: PostsGridProps) {
  if (loading) {
    return (
      <View className="p-10">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View className="w-full p-10 items-center justify-center">
        <Ionicons name={emptyIcon} size={48} color="#e2e8f0" />
        <Text className="mt-3 text-slate-400 text-sm">{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View className="flex-row flex-wrap gap-2 mb-10">
      {posts.map((post) => (
        <TouchableOpacity
          key={post.id}
          style={{ width: Math.round(COLUMN_WIDTH), height: Math.round(COLUMN_WIDTH) }}
          className="rounded-xl overflow-hidden bg-white border border-slate-100"
          onPress={() => onPostPress(post)}
        >
          {post.media_url ? (
            <Image
              source={{
                uri:
                  post.media_type === "video"
                    ? getVideoThumbUrl(post.media_url, {
                        width: 300,
                        height: 300,
                      })
                    : getOptimizedUrl(post.media_url, {
                        width: 300,
                        height: 300,
                      }),
              }}
              className="w-full h-full"
            />
          ) : (
            <View className="flex-1 p-2 bg-slate-50 justify-center">
              <Text
                numberOfLines={3}
                className="text-[10px] text-slate-500 text-center"
              >
                {post.text}
              </Text>
            </View>
          )}
          {post.media_type === "video" && (
            <View className="absolute top-1.5 right-1.5 bg-black/40 w-6 h-6 rounded-xl justify-center items-center">
              <Ionicons name="play" size={14} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}