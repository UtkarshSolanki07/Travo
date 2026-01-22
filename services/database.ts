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

export const database = {
  /**
   * Syncs basic user data from Clerk to Supabase
   */
  /**
   * Syncs basic user data from Clerk to Supabase
   * Only updates display_name and avatar_url if they are currently null in Supabase
   */
  async syncUser(id: string, email: string, username: string, fullName?: string | null, imageUrl?: string | null) {
    // First check if user exists and what data they have
    const { data: existingUser } = await supabase
      .from('users')
      .select('display_name, avatar_url')
      .eq('id', id)
      .maybeSingle()

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

    const { error } = await supabase.from('users').upsert(updateData)
    if (error) throw error
  },

  /**
   * Fetches the profile for a specific user
   */
  async getProfile(userId: string) {
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
    const { error } = await supabase.from('profiles').upsert({
      user_id: userId,
      ...data,
      updated_at: new Date().toISOString()
    })
    if (error) throw error
  },

  /**
   * Specialized update for real-time location tracking
   */
  async updateLiveLocation(userId: string, lat: number, lon: number, interests: string[]) {
    const { error } = await supabase.from('profiles').upsert({
      user_id: userId,
      interests,
      last_latitude: lat,
      last_longitude: lon,
      is_live_tracking: true,
      location_shared_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    if (error) throw error
  },

  /**
   * Fetches data for a specific user from 'users' table
   */
  async getUser(id: string): Promise<User | null> {
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
    // Remove protected fields
    const { id: _id, created_at: _created_at, email: _email, ...updateData } = data as any
    
    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
    
    if (error) throw error
  }
}
