import { getAvatarUrl, getOptimizedUrl } from "@/lib/cloudinary";
import { Post, PostComment } from "@/services/database";
import { Ionicons } from "@expo/vector-icons";
import { VideoView } from "expo-video";
import { useState } from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface PostDetailModalProps {
  visible: boolean;
  post: Post | null;
  comments: PostComment[];
  newComment: string;
  socialLoading: boolean;
  videoPlayer: any;
  currentUserId: string;
  onClose: () => void;
  onToggleLike: () => void;
  onCommentChange: (text: string) => void;
  onAddComment: () => void;
  onDeleteComment: (commentId: string) => void;
  onReplyToComment: (commentId: string, text: string) => void;
  onDeletePost: () => void;
  onEditPost: () => void;
}

export default function PostDetailModal({
  visible,
  post,
  comments,
  newComment,
  socialLoading,
  videoPlayer,
  currentUserId,
  onClose,
  onToggleLike,
  onCommentChange,
  onAddComment,
  onDeleteComment,
  onReplyToComment,
  onDeletePost,
  onEditPost,
}: PostDetailModalProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [showPostOptions, setShowPostOptions] = useState(false);

  const handleReply = (commentId: string) => {
    if (replyText.trim()) {
      onReplyToComment(commentId, replyText.trim());
      setReplyText("");
      setReplyingTo(null);
    }
  };

  const handleDeleteComment = (commentId: string) => {
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDeleteComment(commentId),
        },
      ],
    );
  };

  const handleDeletePost = () => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onDeletePost();
            setShowPostOptions(false);
          },
        },
      ],
    );
  };

  const isMyPost = post?.author_id === currentUserId;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/80 justify-center p-5">
        <View className="bg-white rounded-3xl max-h-[90%] overflow-hidden">
          <View className="flex-row justify-between items-center p-4 border-b border-slate-100">
            <View className="flex-row items-center gap-3">
              {post?.user?.avatar_url ? (
                <Image
                  source={{ uri: getAvatarUrl(post.user.avatar_url, 80) }}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <Ionicons name="person-circle" size={40} color="#6366f1" />
              )}
              <View>
                <Text className="font-bold text-base text-slate-800">
                  {post?.user?.display_name || "User"}
                </Text>
                {post?.location_name && (
                  <Text className="text-xs text-indigo-500">
                    {post.location_name}
                  </Text>
                )}
              </View>
            </View>
            <View className="flex-row gap-2">
              {isMyPost && (
                <TouchableOpacity
                  onPress={() => setShowPostOptions(!showPostOptions)}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={24}
                    color="#64748b"
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          {showPostOptions && isMyPost && (
            <View className="bg-slate-50 border-b border-slate-200">
              <TouchableOpacity
                className="flex-row items-center p-4 gap-3"
                onPress={() => {
                  onEditPost();
                  setShowPostOptions(false);
                }}
              >
                <Ionicons name="create-outline" size={20} color="#6366f1" />
                <Text className="text-slate-700 font-medium">Edit Post</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-row items-center p-4 gap-3 border-t border-slate-200"
                onPress={handleDeletePost}
              >
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                <Text className="text-red-600 font-medium">Delete Post</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView>
            {post?.media_url &&
              (post.media_type === "video" ? (
                <View className="w-full aspect-square bg-black">
                  <VideoView
                    style={{ width: "100%", height: "100%" }}
                    player={videoPlayer}
                    allowsFullscreen
                    allowsPictureInPicture
                    nativeControls
                  />
                </View>
              ) : (
                <Image
                  source={{
                    uri: getOptimizedUrl(post.media_url, { width: 800 }),
                  }}
                  className="w-full aspect-square"
                />
              ))}

            <View className="p-4">
              <View className="flex-row gap-4 mb-3">
                <TouchableOpacity onPress={onToggleLike} className="p-1">
                  <Ionicons
                    name={post?.is_liked ? "heart" : "heart-outline"}
                    size={28}
                    color={post?.is_liked ? "#ef4444" : "#64748b"}
                  />
                </TouchableOpacity>
                <TouchableOpacity className="p-1">
                  <Ionicons
                    name="chatbubble-outline"
                    size={26}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>

              {post?.text && (
                <Text className="text-[15px] text-slate-800 leading-5 mb-5">
                  <Text className="font-bold">{post?.user?.display_name} </Text>
                  {post.venue_name && (
                    <Text className="text-indigo-500 font-semibold">
                      at {post.venue_name}{" "}
                    </Text>
                  )}
                  {post.text}
                </Text>
              )}

              <View className="border-t border-slate-100 pt-4">
                <Text className="text-sm font-semibold text-slate-500 mb-3">
                  Comments
                </Text>
                {comments.map((comment) => (
                  <View key={comment.id} className="mb-4">
                    <View className="flex-row gap-2.5">
                      {comment.user?.avatar_url ? (
                        <Image
                          source={{
                            uri: getAvatarUrl(comment.user.avatar_url, 60),
                          }}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <Ionicons
                          name="person-circle"
                          size={32}
                          color="#94a3b8"
                        />
                      )}
                      <View className="flex-1">
                        <View className="flex-row justify-between items-start">
                          <View className="flex-1">
                            <Text className="font-bold text-[13px] text-slate-800">
                              {comment.user?.display_name}
                            </Text>
                            <Text className="text-[13px] text-slate-600 mt-0.5">
                              {comment.text}
                            </Text>
                          </View>
                          {comment.author_id === currentUserId && (
                            <TouchableOpacity
                              onPress={() => handleDeleteComment(comment.id)}
                              className="ml-2"
                            >
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color="#94a3b8"
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                        <View className="flex-row gap-4 mt-2">
                          <TouchableOpacity
                            onPress={() => setReplyingTo(comment.id)}
                          >
                            <Text className="text-xs text-slate-500 font-medium">
                              Reply
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {replyingTo === comment.id && (
                          <View className="flex-row items-center mt-2 gap-2">
                            <TextInput
                              className="flex-1 bg-slate-100 rounded-full px-3 py-1.5 text-sm"
                              placeholder="Write a reply..."
                              value={replyText}
                              onChangeText={setReplyText}
                              autoFocus
                            />
                            <TouchableOpacity
                              onPress={() => handleReply(comment.id)}
                            >
                              <Ionicons name="send" size={20} color="#6366f1" />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                setReplyingTo(null);
                                setReplyText("");
                              }}
                            >
                              <Ionicons
                                name="close"
                                size={20}
                                color="#94a3b8"
                              />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          <View className="flex-row items-center p-3 border-t border-slate-100 gap-3">
            <TextInput
              className="flex-1 bg-slate-50 rounded-full px-4 py-2 text-sm"
              placeholder="Add a comment..."
              value={newComment}
              onChangeText={onCommentChange}
            />
            <TouchableOpacity
              onPress={onAddComment}
              disabled={socialLoading || !newComment.trim()}
            >
              <Text
                className={`font-bold text-sm ${
                  !newComment.trim() ? "text-indigo-300" : "text-indigo-500"
                }`}
              >
                Post
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
