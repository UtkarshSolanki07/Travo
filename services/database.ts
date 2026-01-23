import { supabase } from '@/lib/supabase'

export interface UserProfile {
  user_id: string
  interests?: string[]
  last_latitude?: number
  last_longitude?: number
  is_live_tracking?: boolean
  location_shared_at?: string
  friends_count?: number
  activities_count?: number
  updated_at?: string
}

export type UserStatus = 'idle' | 'in_activity' | 'looking'

export interface UserPresence {
  user_id: string
  status: UserStatus
  current_activity_id?: string
  last_seen_at?: string
}

export interface User {
  id: string
  email: string
  username: string
  display_name?: string
  avatar_url?: string
  country?: string
  city?: string
  bio?: string
  created_at?: string
}

export type ActivitySize = 'duo' | 'trio' | 'group'
export type ActivityVisibility = 'public' | 'friends' | 'invite_only'

export interface Activity {
  id: string
  creator_id: string
  title: string
  description?: string
  activity_type?: string
  size_type: ActivitySize
  interests?: string[]
  start_time: string
  end_time?: string
  latitude: number
  longitude: number
  city?: string
  max_participants: number
  visibility: ActivityVisibility
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
  created_at?: string
}

export interface Post {
  id: string
  author_id: string
  text?: string
  media_url?: string
  media_type?: 'image' | 'video' | 'note'
  venue_name?: string  // eg: "Cafe", "Monument"
  location_name?: string // eg: "Paris, France"
  city?: string
  country?: string
  visibility?: 'public' | 'friends'
  created_at: string
  user?: User
  likes_count?: number
  comments_count?: number
  is_liked?: boolean
}

export interface PostComment {
  id: string
  post_id: string
  author_id: string
  text: string
  created_at: string
  user?: User
}

export const database = {
  /**
   * Syncs basic user data from Clerk to Supabase
   */
  /**
   * Syncs basic user data from Clerk to Supabase
   * Only updates display_name and avatar_url if they are currently null in Supabase
   */
  async syncUser(id: string, email: string, username: string, fullName?: string | null, imageUrl?: string | null) {
    if (!id || !email) {
      console.warn('syncUser: missing required id or email')
      return
    }

    // First check if user exists and what data they have
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('display_name, avatar_url')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      console.error('syncUser: error fetching existing user', fetchError)
      // We'll proceed with upsert attempt anyway if it's just a fetch error
    }

    const updateData: any = {
      id,
      email,
      username,
    }

    // Only sync display_name and avatar_url from Clerk if they don't exist in our DB
    if (!existingUser?.display_name && fullName) {
      updateData.display_name = fullName
    }
    if (!existingUser?.avatar_url && imageUrl) {
      updateData.avatar_url = imageUrl
    }

    const { error } = await supabase
      .from('users')
      .upsert(updateData, { onConflict: 'id' })
    
    if (error) throw error
  },

  /**
   * Fetches the profile for a specific user
   */
  async getProfile(userId: string) {
    if (!userId) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    
    if (error) throw error
    return data
  },

  /**
   * Updates profile fields (e.g. interests, tracking status)
   */
  async updateProfile(userId: string, data: Partial<UserProfile>) {
    if (!userId) throw new Error('userId is required for updateProfile')
    
    // Filter out undefined values to prevent nulling columns
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    )

    const { error } = await supabase
      .from('profiles')
      .upsert({
        user_id: userId,
        ...filteredData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
    
    if (error) throw error
  },

  /**
   * Specialized update for real-time location tracking
   */
  async updateLiveLocation(userId: string, lat: number, lon: number, interests: string[]) {
    if (!userId) throw new Error('userId is required for updateLiveLocation')
    
    const { error } = await supabase
      .from('profiles')
      .upsert({
        user_id: userId,
        interests,
        last_latitude: lat,
        last_longitude: lon,
        is_live_tracking: true,
        location_shared_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
    
    if (error) throw error
  },

  /**
   * Fetches data for a specific user from 'users' table
   */
  async getUser(id: string): Promise<User | null> {
    if (!id) return null
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    
    if (error) throw error
    return data
  },

  /**
   * Updates basic user data (name, avatar, location info)
   */
  async updateUser(id: string, data: Partial<User>) {
    if (!id) throw new Error('id is required for updateUser')

    // Filter out undefined and protected fields
    const { id: _id, created_at: _created_at, email: _email, ...rest } = data as any
    const updateData = Object.fromEntries(
      Object.entries(rest).filter(([_, v]) => v !== undefined)
    )
    
    if (Object.keys(updateData).length === 0) return

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
    
    if (error) throw error
  },

  /**
   * Fetches posts made by a specific user
   */
  async getPosts(userId: string): Promise<Post[]> {
    if (!userId) return []
    const { data, error } = await supabase
      .from('posts')
      .select('*, user:users!posts_author_id_fkey(*)')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('getPosts error:', error)
      return [] // Return empty array on error for now
    }
    return data || []
  },

  /**
   * Fetches posts where the user is tagged
   */
  async getTaggedPosts(userId: string): Promise<Post[]> {
    if (!userId) return []
    const { data, error } = await supabase
      .from('post_tags')
      .select('post:posts(*, user:users!posts_author_id_fkey(*))')
      .eq('user_id', userId)
      .order('created_at', { foreignTable: 'posts', ascending: false })
    
    if (error) {
      console.error('getTaggedPosts error:', error)
      return []
    }
    // Flatten the result since it's a join
    return (data || []).map((item: any) => item.post).filter(Boolean)
  },

  /**
   * Increments friend count for a user (placeholder for friend flow)
   */
  async incrementFriendsCount(userId: string) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('friends_count')
      .eq('user_id', userId)
      .single()
    
    await this.updateProfile(userId, {
      friends_count: (profile?.friends_count || 0) + 1
    })
  },

  /**
   * Increments activity count for a user (placeholder for activity flow)
   */
  async incrementActivitiesCount(userId: string) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('activities_count')
      .eq('user_id', userId)
      .single()
    
    await this.updateProfile(userId, {
      activities_count: (profile?.activities_count || 0) + 1
    })
  },

  /**
   * Creates a new post
   */
  async createPost(data: Partial<Post>) {
    const id = Math.random().toString(36).substring(2, 15) // Simple ID generator
    const { error } = await supabase
      .from('posts')
      .insert({
        id,
        created_at: new Date().toISOString(),
        ...data
      })
    
    if (error) throw error
    return id
  },

  /**
   * Toggles a like on a post for a specific user
   */
  async toggleLike(postId: string, userId: string) {
    // Check if already liked
    const { data: existingLike } = await supabase
      .from('post_likes')
      .select('*')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingLike) {
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId)
      if (error) throw error
      return false // Unliked
    } else {
      const { error } = await supabase
        .from('post_likes')
        .insert({ post_id: postId, user_id: userId })
      if (error) throw error
      return true // Liked
    }
  },

  /**
   * Fetches comments for a specific post
   */
  async getComments(postId: string): Promise<PostComment[]> {
    const { data, error } = await supabase
      .from('post_comments')
      .select('*, user:users(*)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    return data || []
  },

  /**
   * Adds a comment to a post
   */
  async addComment(postId: string, userId: string, text: string) {
    const id = Math.random().toString(36).substring(2, 15)
    const { error } = await supabase
      .from('post_comments')
      .insert({
        id,
        post_id: postId,
        author_id: userId,
        text,
        created_at: new Date().toISOString()
      })
    
    if (error) throw error
  }
}
