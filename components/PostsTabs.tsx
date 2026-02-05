import { View, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface PostsTabsProps {
  activeTab: 'posts' | 'tagged'
  onTabChange: (tab: 'posts' | 'tagged') => void
}

/**
 * Renders a two-option tab switcher for selecting between "My Posts" and "Tagged".
 *
 * @param activeTab - Current active tab, either 'posts' or 'tagged'.
 * @param onTabChange - Callback invoked with the selected tab key ('posts' | 'tagged') when a tab is pressed.
 * @returns The tab control as a JSX element.
 */
export default function PostsTabs({ activeTab, onTabChange }: PostsTabsProps) {
  return (
    <View className="flex-row mb-4 bg-white rounded-2xl p-1.5 border border-slate-100">
      <TouchableOpacity 
        className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl gap-2 ${
          activeTab === 'posts' ? 'bg-indigo-50' : ''
        }`}
        onPress={() => onTabChange('posts')}
      >
        <Ionicons 
          name="grid-outline" 
          size={20} 
          color={activeTab === 'posts' ? '#6366f1' : '#64748b'} 
        />
        <Text className={`text-sm font-semibold ${
          activeTab === 'posts' ? 'text-indigo-500' : 'text-slate-500'
        }`}>
          My Posts
        </Text>
      </TouchableOpacity>
      <TouchableOpacity 
        className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl gap-2 ${
          activeTab === 'tagged' ? 'bg-indigo-50' : ''
        }`}
        onPress={() => onTabChange('tagged')}
      >
        <Ionicons 
          name="people-outline" 
          size={20} 
          color={activeTab === 'tagged' ? '#6366f1' : '#64748b'} 
        />
        <Text className={`text-sm font-semibold ${
          activeTab === 'tagged' ? 'text-indigo-500' : 'text-slate-500'
        }`}>
          Tagged
        </Text>
      </TouchableOpacity>
    </View>
  )
}