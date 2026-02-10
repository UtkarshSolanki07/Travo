import { supabase } from "@/lib/supabase";
import * as Crypto from "expo-crypto";

export interface UserProfile {
  user_id: string;
  interests?: string[];
  last_latitude?: number;
  last_longitude?: number;
  is_live_tracking?: boolean;
  location_shared_at?: string;
  friends_count?: number;
  activities_count?: number;
  updated_at?: string;
}

export type UserStatus = "idle" | "in_activity" | "looking";

export interface UserPresence {
  user_id: string;
  status: UserStatus;
  current_activity_id?: string;
  last_seen_at?: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  country?: string;
  city?: string;
  bio?: string;
  created_at?: string;
}

export type ActivitySize = "duo" | "trio" | "group";
export type ActivityVisibility = "public" | "friends" | "invite_only";

export interface Activity {
  id: string;
  creator_id: string;
  title: string;
  description?: string;
  activity_type?: string;
  size_type: ActivitySize;
  interests?: string[];
  start_time: string;
  end_time?: string;
  latitude: number;
  longitude: number;
  city?: string;
  max_participants: number;
  visibility: ActivityVisibility;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  created_at?: string;
}

export interface Post {
  id: string;
  author_id: string;
  text?: string;
  media_url?: string;
  media_type?: "image" | "video" | "note";
  venue_name?: string; // eg: "Cafe", "Monument"
  location_name?: string; // eg: "Paris, France"
  city?: string;
  country?: string;
  visibility?: "public" | "friends";
  created_at: string;
  user?: User;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  text: string;
  created_at: string;
  user?: User;
}

export const database = {
  async syncUser(
    id: string,
    email: string,
    username: string,
    fullName?: string | null,
    imageUrl?: string | null,
  ) {
    if (!id || !email) {
      console.warn("syncUser: missing required id or email");
      return;
    }

    // First check if user exists and what data they have
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("display_name, avatar_url")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      console.error("syncUser: error fetching existing user", fetchError);
      // We'll proceed with upsert attempt anyway if it's just a fetch error
    }

    const updateData: any = {
      id,
      email,
      username,
    };

    // Only sync display_name and avatar_url from Clerk if they don't exist in our DB
    if (!existingUser?.display_name && fullName) {
      updateData.display_name = fullName;
    }
    if (!existingUser?.avatar_url && imageUrl) {
      updateData.avatar_url = imageUrl;
    }

    const { error } = await supabase
      .from("users")
      .upsert(updateData, { onConflict: "id" });

    if (error) throw error;
  },

  /**
   * Fetches the profile for a specific user
   */
  async getProfile(userId: string) {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Updates profile fields (e.g. interests, tracking status)
   */
  async updateProfile(userId: string, data: Partial<UserProfile>) {
    if (!userId) throw new Error("userId is required for updateProfile");

    // Filter out undefined values to prevent nulling columns
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined),
    );

    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: userId,
        ...filteredData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) throw error;
  },

  /**
   * Specialized update for real-time location tracking
   */
  async updateLiveLocation(
    userId: string,
    lat: number,
    lon: number,
    interests: string[],
  ) {
    if (!userId) throw new Error("userId is required for updateLiveLocation");

    const { error } = await supabase.from("profiles").upsert(
      {
        user_id: userId,
        interests,
        last_latitude: lat,
        last_longitude: lon,
        is_live_tracking: true,
        location_shared_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) throw error;
  },

  /**
   * Fetches data for a specific user from 'users' table
   */
  async getUser(id: string): Promise<User | null> {
    if (!id) return null;
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Updates basic user data (name, avatar, location info)
   */
  async updateUser(id: string, data: Partial<User>) {
    if (!id) throw new Error("id is required for updateUser");

    // Filter out undefined and protected fields
    const {
      id: _id,
      created_at: _created_at,
      email: _email,
      ...rest
    } = data as any;
    const updateData = Object.fromEntries(
      Object.entries(rest).filter(([_, v]) => v !== undefined),
    );

    if (Object.keys(updateData).length === 0) return;

    const { error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;
  },

  /**
   * Fetches posts made by a specific user
   */
  async getPosts(userId: string): Promise<Post[]> {
    if (!userId) return [];
    const { data, error } = await supabase
      .from("posts")
      .select("*, user:users!posts_author_id_fkey(*)")
      .eq("author_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getPosts error:", error);
      return []; // Return empty array on error for now
    }
    return data || [];
  },

  /**
   * Fetches posts where the user is tagged
   */
  async getTaggedPosts(userId: string): Promise<Post[]> {
    if (!userId) return [];
    const { data, error } = await supabase
      .from("post_tags")
      .select("post:posts(*, user:users!posts_author_id_fkey(*))")
      .eq("user_id", userId)
      .order("created_at", { foreignTable: "posts", ascending: false });

    if (error) {
      console.error("getTaggedPosts error:", error);
      return [];
    }
    // Flatten the result since it's a join
    return (data || []).map((item: any) => item.post).filter(Boolean);
  },

  /**
   * Increments friend count for a user (placeholder for friend flow)
   */
  async incrementFriendsCount(userId: string) {
    const { error } = await supabase.rpc("increment_friends_count", {
      user_id_arg: userId,
    });
    if (error) throw error;
  },

  /**
   * Increments activity count for a user (placeholder for activity flow)
   */
  async incrementActivitiesCount(userId: string) {
    const { error } = await supabase.rpc("increment_activities_count", {
      user_id_arg: userId,
    });
    if (error) throw error;
  },

  /**
   * Creates a new post
   */
  async createPost(data: Partial<Post>) {
    const id = Crypto.randomUUID();
    const { error } = await supabase.from("posts").insert({
      id,
      created_at: new Date().toISOString(),
      ...data,
    });

    if (error) throw error;
    return id;
  },

  /**
   * Toggles a like on a post for a specific user
   */
  async toggleLike(postId: string, userId: string) {
    // Try to delete first - if it succeeds, we unliked
    const { data: deleted, error: deleteError } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId)
      .select();
    if (deleteError) throw deleteError;

    if (deleted && deleted.length > 0) {
      return false; // Unliked
    }

    // Nothing was deleted, so insert
    const { error: insertError } = await supabase
      .from("post_likes")
      .insert({ post_id: postId, user_id: userId });

    if (insertError) {
      // Handle unique constraint violation (concurrent insert)
      if (insertError.code === "23505") return true;
      throw insertError;
    }
    return true; // Liked
  },

  /**
   * Fetches comments for a specific post
   */
  async getComments(postId: string): Promise<PostComment[]> {
    const { data, error } = await supabase
      .from("post_comments")
      .select("*, user:users(*)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Adds a comment to a post
   */
  async addComment(postId: string, userId: string, text: string) {
    const id = Crypto.randomUUID();
    const { error } = await supabase.from("post_comments").insert({
      id,
      post_id: postId,
      author_id: userId,
      text,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;
  },

  async deleteComment(commentId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from("post_comments")
      .delete()
      .eq("id", commentId)
      .eq("author_id", userId);
    if (error) throw error;
  },

  async deletePost(postId: string, userId: string): Promise<void> {
    // First check if user is the author
    const { data: post, error: fetchError } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", postId)
      .single();
    if (fetchError) throw fetchError;
    if (post.author_id !== userId) throw new Error("Unauthorized");
    // Delete associated comments
    await supabase.from("post_comments").delete().eq("post_id", postId);
    // Delete associated likes
    await supabase.from("post_likes").delete().eq("post_id", postId);
    // Delete the post
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) throw error;
  },

  async updatePost(
    postId: string,
    userId: string,
    updates: {
      text?: string;
      media_url?: string;
      media_type?: "image" | "video" | "note";
      venue_name?: string;
      location_name?: string;
      city?: string;
      country?: string;
      visibility?: "public" | "friends";
    },
  ): Promise<void> {
    const updateData: any = {};
    if (updates.text !== undefined) updateData.text = updates.text;
    if (updates.media_url !== undefined)
      updateData.media_url = updates.media_url;
    if (updates.media_type !== undefined)
      updateData.media_type = updates.media_type;
    if (updates.venue_name !== undefined)
      updateData.venue_name = updates.venue_name;
    if (updates.location_name !== undefined)
      updateData.location_name = updates.location_name;
    if (updates.city !== undefined) updateData.city = updates.city;
    if (updates.country !== undefined) updateData.country = updates.country;
    if (updates.visibility !== undefined)
      updateData.visibility = updates.visibility;
    updateData.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from("posts")
      .update(updateData)
      .eq("id", postId)
      .eq("author_id", userId);
    if (error) throw error;
  },

  async addReply(
    postId: string,
    userId: string,
    parentCommentId: string,
    text: string,
  ): Promise<void> {
    const id = Crypto.randomUUID();
    const { error } = await supabase.from("post_comments").insert({
      id,
      post_id: postId,
      author_id: userId,
      parent_comment_id: parentCommentId,
      text,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;
  },

  async getReplies(commentId: string): Promise<PostComment[]> {
    const { data, error } = await supabase
      .from("post_comments")
      .select("*, user:users(username, display_name, avatar_url)")
      .eq("parent_comment_id", commentId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data || []).map((reply) => ({
      ...reply,
      user: {
        id: reply.author_id,
        username: reply.user?.username || "",
        display_name: reply.user?.display_name || "",
        avatar_url: reply.user?.avatar_url || "",
      },
    }));
  },
};
