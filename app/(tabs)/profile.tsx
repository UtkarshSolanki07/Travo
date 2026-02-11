import { useMapContext } from "@/context/MapContext";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { database, Post, PostComment, User } from "@/services/database";
import { searchLocations, searchVenues } from "@/services/geoapify";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-expo";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useVideoPlayer } from "expo-video";
import debounce from "lodash.debounce";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";

import CreatePostModal from "@/components/CreatePostModal";
import EditPostModal from "@/components/EditPostModal";
import EditProfileForm from "@/components/EditProfileForm";
import InterestsSection from "@/components/InterestsSection";
import LoggedOutView from "@/components/LoggedOutView";
import PostDetailModal from "@/components/PostDetailModal";
import PostsGrid from "@/components/PostsGrid";
import PostsTabs from "@/components/PostsTabs";
import ProfileHeader from "@/components/ProfileHeader";

/**
 * Render the user's profile screen with profile details, interests, posts, and post creation/edit flows.
 *
 * Manages loading and updating profile and posts data, interest selection, media picking and upload, debounced venue/location searches (with optional device location), video playback for create/edit/detail views, and social interactions (likes, comments). Shows an authenticated UI when signed in and a logged-out view otherwise.
 *
 * @returns The profile screen JSX element composed of the profile header, edit form, posts tabs and grid, interests section, create/edit post modals, post detail modal, and a logged-out view when no user is signed in.
 */
export default function ProfileScreen() {
  const { user: clerkUser } = useUser();
  const { userLocation, setUserLocation: updateLocation } = useMapContext();

  // Profile Data
  const [userData, setUserData] = useState<User | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [friendsCount, setFriendsCount] = useState(0);
  const [activitiesCount, setActivitiesCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"posts" | "tagged">("posts");
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [taggedPosts, setTaggedPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // UI States
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingData, setEditingData] = useState<Partial<User>>({});
  const [customInterest, setCustomInterest] = useState("");

  // Create Post States
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [postText, setPostText] = useState("");
  const [postMedia, setPostMedia] = useState<{
    uri: string;
    type: "image" | "video";
  } | null>(null);
  const [venueName, setVenueName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [venueResults, setVenueResults] = useState<any[]>([]);
  const [locationResults, setLocationResults] = useState<any[]>([]);
  const [postCity, setPostCity] = useState("");
  const [postCountry, setPostCountry] = useState("");
  const [isSearchingVenue, setIsSearchingVenue] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [creating, setCreating] = useState(false);
  const [postVisibility, setPostVisibility] = useState<"public" | "friends">(
    "public",
  );

  // Edit Post States
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Post Detail States
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isPostDetailVisible, setIsPostDetailVisible] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [socialLoading, setSocialLoading] = useState(false);

  // Video players
  const createPlayer = useVideoPlayer(
    postMedia?.type === "video" ? postMedia.uri : "",
    (player) => {
      player.loop = true;
    },
  );
  const detailPlayer = useVideoPlayer("", (player) => {
    player.loop = true;
  });
  const editPlayer = useVideoPlayer("", (player) => {
    player.loop = true;
  });

  const safeReplace = async (player: any, uri?: string) => {
    if (!uri || !player) return;
    try {
      if (typeof player.replaceAsync === "function") {
        await player.replaceAsync(uri);
      } else if (typeof player.replace === "function") {
        player.replace(uri);
      }
    } catch (error) {
      console.error("Error replacing video:", error);
    }
  };

  useEffect(() => {
    if (postMedia?.type === "video") {
      (async () => {
        await safeReplace(createPlayer, postMedia.uri);
        createPlayer.play();
      })();
    } else {
      createPlayer.pause();
    }
  }, [postMedia, createPlayer]);

  useEffect(() => {
    if (
      isPostDetailVisible &&
      selectedPost?.media_type === "video" &&
      selectedPost.media_url
    ) {
      console.log("Loading video in detail modal:", selectedPost.media_url);
      (async () => {
        try {
          await safeReplace(detailPlayer, selectedPost.media_url);
          detailPlayer.play();
        } catch (error) {
          console.error("Error loading video:", error);
        }
      })();
    } else {
      detailPlayer.pause();
    }
  }, [isPostDetailVisible, selectedPost, detailPlayer]);

  useEffect(() => {
    (async () => {
      try {
        if (
          isEditingPost &&
          selectedPost?.media_type === "video" &&
          selectedPost.media_url &&
          !postMedia
        ) {
          await safeReplace(editPlayer, selectedPost.media_url);
          editPlayer.play();
        } else if (postMedia?.type === "video") {
          await safeReplace(editPlayer, postMedia.uri);
          editPlayer.play();
        } else {
          editPlayer.pause();
        }
      } catch (error) {
        console.error("Error loading edit video:", error);
      }
    })();
  }, [isEditingPost, selectedPost, postMedia, editPlayer]);

  const loadProfile = useCallback(async () => {
    if (!clerkUser) return;
    setLoading(true);
    try {
      const user = await database.getUser(clerkUser.id);
      if (user) {
        setUserData(user);
        setEditingData(user);
      }

      const profile = await database.getProfile(clerkUser.id);
      if (profile) {
        setSelectedInterests(profile.interests || []);
        setFriendsCount(profile.friends_count || 0);
        setActivitiesCount(profile.activities_count || 0);
      }

      setPostsLoading(true);
      const [posts, tagged] = await Promise.all([
        database.getPosts(clerkUser.id),
        database.getTaggedPosts(clerkUser.id),
      ]);
      setMyPosts(posts);
      setTaggedPosts(tagged);
    } catch (_error) {
      console.error("Error loading profile:", _error);
    } finally {
      setLoading(false);
      setPostsLoading(false);
    }
  }, [clerkUser]);

  useEffect(() => {
    if (clerkUser) {
      loadProfile();
    }
  }, [clerkUser, loadProfile]);

  const toggleInterest = async (interest: string) => {
    const previousInterests = [...selectedInterests];
    const newInterests = selectedInterests.includes(interest)
      ? selectedInterests.filter((i) => i !== interest)
      : [...selectedInterests, interest];

    setSelectedInterests(newInterests);

    if (clerkUser) {
      try {
        await database.updateProfile(clerkUser.id, { interests: newInterests });
      } catch (error) {
        console.error("Error updating interests:", error);
        setSelectedInterests(previousInterests);
        Alert.alert("Error", "Failed to update interests. Please try again.");
      }
    }
  };

  const addCustomInterest = async () => {
    if (!customInterest.trim()) return;
    const interest = customInterest.trim();
    if (selectedInterests.includes(interest)) {
      setCustomInterest("");
      return;
    }

    const previousInterests = [...selectedInterests];
    const newInterests = [...selectedInterests, interest];

    setSelectedInterests(newInterests);
    setCustomInterest("");

    if (clerkUser) {
      try {
        await database.updateProfile(clerkUser.id, { interests: newInterests });
      } catch (error) {
        console.error("Error adding interest:", error);
        setSelectedInterests(previousInterests);
        Alert.alert("Error", "Failed to save interest. Please try again.");
      }
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      try {
        setSaving(true);
        const uploadUrl = await uploadToCloudinary(
          result.assets[0].uri,
          "image",
        );
        setEditingData((prev) => ({ ...prev, avatar_url: uploadUrl }));

        if (clerkUser) {
          await database.updateUser(clerkUser.id, { avatar_url: uploadUrl });
          setUserData((prev) =>
            prev ? { ...prev, avatar_url: uploadUrl } : null,
          );
        }

        Alert.alert("Success", "Profile picture updated successfully!");
      } catch (error) {
        console.error("Upload/Save error:", error);
        Alert.alert("Error", "Failed to update profile picture");
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!clerkUser) return;
    setSaving(true);
    try {
      await database.updateUser(clerkUser.id, editingData);
      setUserData((prev) => (prev ? { ...prev, ...editingData } : null));
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      console.error("Save profile error:", error);
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const pickPostMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      setPostMedia({
        uri: result.assets[0].uri,
        type: result.assets[0].type === "video" ? "video" : "image",
      });
    }
  };

  const handleCreatePost = async () => {
    if (!clerkUser) return;
    if (!postMedia && !postText) {
      Alert.alert("Error", "Please add some content to your post");
      return;
    }

    setCreating(true);
    try {
      let mediaUrl = "";
      if (postMedia) {
        mediaUrl = await uploadToCloudinary(postMedia.uri, postMedia.type);
      }

      await database.createPost({
        author_id: clerkUser.id,
        text: postText,
        media_url: mediaUrl,
        media_type: postMedia?.type || "note",
        venue_name: venueName,
        location_name: locationName,
        city: postCity,
        country: postCountry,
        visibility: postVisibility,
      });

      Alert.alert("Success", "Post created successfully!");
      setIsCreatingPost(false);
      setPostText("");
      setPostMedia(null);
      setVenueName("");
      setLocationName("");
      setVenueResults([]);
      setLocationResults([]);
      setPostCity("");
      setPostCountry("");
      setPostVisibility("public");
      loadProfile();
    } catch (error) {
      console.error("Create post error:", error);
      Alert.alert("Error", "Failed to create post");
    } finally {
      setCreating(false);
    }
  };

  const debouncedVenueSearch = useRef(
    debounce(async (query: string, currentLoc: any) => {
      setIsSearchingVenue(true);
      try {
        const results = await searchVenues(query, currentLoc || undefined);
        setVenueResults(results);
      } catch {
        console.error("Venue search error");
      } finally {
        setIsSearchingVenue(false);
      }
    }, 400),
  ).current;

  const debouncedLocationSearch = useRef(
    debounce(async (query: string, currentLoc: any) => {
      setIsSearchingLocation(true);
      try {
        const results = await searchLocations(query, currentLoc || undefined);
        setLocationResults(results);
      } catch {
        console.error("Location search error");
      } finally {
        setIsSearchingLocation(false);
      }
    }, 400),
  ).current;

  const handleSearchVenue = async (query: string) => {
    setVenueName(query);
    if (query.length < 3) {
      setVenueResults([]);
      debouncedVenueSearch.cancel();
      return;
    }

    let currentLoc = userLocation;
    if (!currentLoc) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({});
          currentLoc = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          updateLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }
      } catch (e) {
        console.error("Silent location fetch failed", e);
      }
    }

    debouncedVenueSearch(query, currentLoc);
  };

  const handleSearchLocation = async (query: string) => {
    setLocationName(query);
    if (query.length < 3) {
      setLocationResults([]);
      debouncedLocationSearch.cancel();
      return;
    }

    let currentLoc = userLocation;
    if (!currentLoc) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({});
          currentLoc = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          updateLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }
      } catch (e) {
        console.error("Silent location fetch failed", e);
      }
    }

    debouncedLocationSearch(query, currentLoc);
  };

  const selectVenue = (place: any) => {
    setVenueName(place.text || place.place_name.split(",")[0]);
    setVenueResults([]);

    const city =
      place.properties?.city ||
      place.context?.find((c: any) => c.id.startsWith("city"))?.text ||
      "";
    const country =
      place.properties?.country ||
      place.context?.find((c: any) => c.id.startsWith("country"))?.text ||
      "";

    if (city) setPostCity(city);
    if (country) setPostCountry(country);

    if (!locationName) {
      if (city || country) {
        setLocationName(`${city}${city && country ? ", " : ""}${country}`);
      } else {
        const parts = place.place_name.split(", ");
        if (parts.length > 2) {
          setLocationName(parts.slice(-2).join(", "));
        }
      }
    }
  };

  const selectLocation = (place: any) => {
    setLocationName(place.place_name);
    setLocationResults([]);

    const city =
      place.properties?.city ||
      place.context?.find((c: any) => c.id.startsWith("city"))?.text ||
      "";
    const country =
      place.properties?.country ||
      place.context?.find((c: any) => c.id.startsWith("country"))?.text ||
      "";

    if (city) setPostCity(city);
    if (country) setPostCountry(country);
  };

  const openPostDetail = async (post: Post) => {
    setSelectedPost(post);
    setIsPostDetailVisible(true);
    try {
      const postComments = await database.getComments(post.id);
      setComments(postComments);
    } catch (error) {
      console.error("Error loading comments:", error);
    }
  };

  const handleToggleLike = async () => {
    if (!clerkUser || !selectedPost) return;
    try {
      const isLikedNow = await database.toggleLike(
        selectedPost.id,
        clerkUser.id,
      );
      setSelectedPost((prev) =>
        prev
          ? {
              ...prev,
              is_liked: isLikedNow,
              likes_count: (prev.likes_count || 0) + (isLikedNow ? 1 : -1),
            }
          : null,
      );

      const updateList = (list: Post[]) =>
        list.map((p) =>
          p.id === selectedPost.id
            ? {
                ...p,
                is_liked: isLikedNow,
                likes_count: (p.likes_count || 0) + (isLikedNow ? 1 : -1),
              }
            : p,
        );
      setMyPosts(updateList);
      setTaggedPosts(updateList);
    } catch (error) {
      console.error("Like toggle error:", error);
    }
  };

  const handleAddComment = async () => {
    if (!clerkUser || !selectedPost || !newComment.trim()) return;
    setSocialLoading(true);
    try {
      await database.addComment(
        selectedPost.id,
        clerkUser.id,
        newComment.trim(),
      );
      setNewComment("");
      const updatedComments = await database.getComments(selectedPost.id);
      setComments(updatedComments);
    } catch (error) {
      Alert.alert("Error", "Failed to add comment");
      console.log(error);
    } finally {
      setSocialLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!clerkUser || !selectedPost) return;
    try {
      await database.deleteComment(commentId, clerkUser.id);
      const updatedComments = await database.getComments(selectedPost.id);
      setComments(updatedComments);
      Alert.alert("Success", "Comment deleted");
    } catch (error) {
      Alert.alert("Error", "Error deleting comment");
      console.log(error);
    }
  };

  const handleReplyToComment = async (commentId: string, text: string) => {
    if (!clerkUser || !selectedPost) return;
    try {
      // You can implement nested comments or mention system here
      // For now, we'll add as a regular comment with a mention
      const comment = comments.find((c) => c.id === commentId);
      const replyText = comment?.user?.display_name
        ? `@${comment.user.display_name} ${text}`
        : text;

      await database.addComment(selectedPost.id, clerkUser.id, replyText);
      const updatedComments = await database.getComments(selectedPost.id);
      setComments(updatedComments);
      Alert.alert("Success", "Reply added");
    } catch (error) {
      Alert.alert("Error", "Failed to add reply");
      console.log(error);
    }
  };

  const handleDeletePost = async () => {
    if (!clerkUser || !selectedPost) return;
    try {
      await database.deletePost(selectedPost.id, clerkUser.id);
      setIsPostDetailVisible(false);
      setSelectedPost(null);
      Alert.alert("Success", "Post deleted");
      loadProfile(); // Reload posts
    } catch (error) {
      Alert.alert("Error", "Failed to delete post");
      console.log(error);
    }
  };

  const handleEditPostOpen = () => {
    if (!selectedPost) return;
    setIsPostDetailVisible(false);
    setEditingPostId(selectedPost.id);
    setPostText(selectedPost.text || "");
    setVenueName(selectedPost.venue_name || "");
    setLocationName(selectedPost.location_name || "");
    setPostCity(selectedPost.city || "");
    setPostCountry(selectedPost.country || "");
    setPostVisibility(selectedPost.visibility || "public");
    setPostMedia(null); // Will show existing media from selectedPost
    setIsEditingPost(true);
  };

  const handleUpdatePost = async () => {
    if (!clerkUser || !editingPostId) return;
    if (!postMedia && !postText && !selectedPost?.media_url) {
      Alert.alert("Error", "Please add some content to your post");
      return;
    }

    setUpdating(true);
    try {
      let mediaUrl = selectedPost?.media_url || "";
      let mediaType = selectedPost?.media_type || "note";

      // If new media is selected, upload it
      if (postMedia) {
        mediaUrl = await uploadToCloudinary(postMedia.uri, postMedia.type);
        mediaType = postMedia.type;
      }

      await database.updatePost(editingPostId, clerkUser.id, {
        text: postText,
        media_url: mediaUrl,
        media_type: mediaType as any,
        venue_name: venueName,
        location_name: locationName,
        city: postCity,
        country: postCountry,
        visibility: postVisibility,
      });

      Alert.alert("Success", "Post updated successfully!");
      setIsEditingPost(false);
      setEditingPostId(null);
      setPostText("");
      setPostMedia(null);
      setVenueName("");
      setLocationName("");
      setVenueResults([]);
      setLocationResults([]);
      loadProfile(); // Reload posts
    } catch (error) {
      console.error("Update post error:", error);
      Alert.alert("Error", "Failed to update post");
    } finally {
      setUpdating(false);
    }
  };

  if (clerkUser && loading) {
    return (
      <View className="flex-1 bg-slate-50 justify-center items-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerStyle={{ padding: 24, paddingTop: 60 }}
    >
      <SignedIn>
        <ProfileHeader
          userData={userData}
          friendsCount={friendsCount}
          activitiesCount={activitiesCount}
          isEditing={isEditing}
          onEditPress={() => setIsEditing(true)}
          onCreatePostPress={() => setIsCreatingPost(true)}
          onAvatarPress={pickImage}
          editingData={editingData}
        />

        {isEditing && (
          <EditProfileForm
            editingData={editingData}
            saving={saving}
            onDataChange={setEditingData}
            onSave={handleSaveProfile}
            onCancel={() => {
              setIsEditing(false);
              setEditingData(userData || {});
            }}
          />
        )}

        <PostsTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <PostsGrid
          posts={activeTab === "posts" ? myPosts : taggedPosts}
          loading={postsLoading}
          emptyMessage={
            activeTab === "posts" ? "No posts yet" : "No tagged posts"
          }
          emptyIcon={
            activeTab === "posts" ? "images-outline" : "person-add-outline"
          }
          onPostPress={openPostDetail}
        />

        <InterestsSection
          selectedInterests={selectedInterests}
          customInterest={customInterest}
          onCustomInterestChange={setCustomInterest}
          onAddCustomInterest={addCustomInterest}
          onToggleInterest={toggleInterest}
        />

        <CreatePostModal
          visible={isCreatingPost}
          postText={postText}
          postMedia={postMedia}
          venueName={venueName}
          locationName={locationName}
          venueResults={venueResults}
          locationResults={locationResults}
          isSearchingVenue={isSearchingVenue}
          isSearchingLocation={isSearchingLocation}
          creating={creating}
          videoPlayer={createPlayer}
          postCity={postCity}
          postCountry={postCountry}
          visibility={postVisibility}
          onVisibilityChange={setPostVisibility}
          onClose={() => setIsCreatingPost(false)}
          onPostTextChange={setPostText}
          onPickMedia={pickPostMedia}
          onRemoveMedia={() => setPostMedia(null)}
          onVenueSearch={handleSearchVenue}
          onLocationSearch={handleSearchLocation}
          onSelectVenue={selectVenue}
          onSelectLocation={selectLocation}
          onCreatePost={handleCreatePost}
        />

        <EditPostModal
          visible={isEditingPost}
          post={selectedPost}
          postText={postText}
          postMedia={postMedia}
          venueName={venueName}
          locationName={locationName}
          venueResults={venueResults}
          locationResults={locationResults}
          isSearchingVenue={isSearchingVenue}
          isSearchingLocation={isSearchingLocation}
          updating={updating}
          videoPlayer={editPlayer}
          postCity={postCity}
          postCountry={postCountry}
          visibility={postVisibility}
          onVisibilityChange={setPostVisibility}
          onClose={() => {
            setIsEditingPost(false);
            setEditingPostId(null);
            setPostText("");
            setPostMedia(null);
            setVenueName("");
            setLocationName("");
            setPostCity("");
            setPostCountry("");
            setPostVisibility("public");
          }}
          onPostTextChange={setPostText}
          onPickMedia={pickPostMedia}
          onRemoveMedia={() => setPostMedia(null)}
          onVenueSearch={handleSearchVenue}
          onLocationSearch={handleSearchLocation}
          onSelectVenue={selectVenue}
          onSelectLocation={selectLocation}
          onUpdatePost={handleUpdatePost}
        />

        <PostDetailModal
          visible={isPostDetailVisible}
          post={selectedPost}
          comments={comments}
          newComment={newComment}
          socialLoading={socialLoading}
          videoPlayer={detailPlayer}
          currentUserId={clerkUser?.id || ""}
          onClose={() => setIsPostDetailVisible(false)}
          onToggleLike={handleToggleLike}
          onCommentChange={setNewComment}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          onReplyToComment={handleReplyToComment}
          onDeletePost={handleDeletePost}
          onEditPost={handleEditPostOpen}
        />
      </SignedIn>

      <SignedOut>
        <LoggedOutView />
      </SignedOut>
    </ScrollView>
  );
}