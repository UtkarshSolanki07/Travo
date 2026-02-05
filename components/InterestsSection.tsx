import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const INITIAL_INTERESTS = [
  'Clubbing', 'Cafe Hopping', 'Museums', 'Hiking', 
  'Beach', 'Going to new places', 'Shopping', 'Dining',
  'Outdoor Sports', 'Live Music', 'Art Galleries'
]

interface InterestsSectionProps {
  selectedInterests: string[]
  customInterest: string
  onCustomInterestChange: (text: string) => void
  onAddCustomInterest: () => void
  onToggleInterest: (interest: string) => void
}

export default function InterestsSection({
  selectedInterests,
  customInterest,
  onCustomInterestChange,
  onAddCustomInterest,
  onToggleInterest
}: InterestsSectionProps) {
  return (
    <View className="bg-white rounded-3xl p-5 mb-5 shadow-sm">
      <Text className="text-lg font-semibold text-slate-800 mb-4">Interests</Text>
      
      <View className="flex-row gap-2.5 mb-4">
        <TextInput
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[15px]"
          placeholder="Add your own interest..."
          value={customInterest}
          onChangeText={onCustomInterestChange}
          onSubmitEditing={onAddCustomInterest}
        />
        <TouchableOpacity 
          className="bg-indigo-500 w-11 h-11 rounded-xl justify-center items-center"
          onPress={onAddCustomInterest}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View className="flex-row flex-wrap gap-2.5">
        {selectedInterests.map(interest => (
          <TouchableOpacity 
            key={interest}
            className="px-3.5 py-2 rounded-full bg-indigo-500 border border-indigo-500"
            onPress={() => onToggleInterest(interest)}
          >
            <Text className="text-sm text-white font-medium">
              {interest}
            </Text>
          </TouchableOpacity>
        ))}
        
        {INITIAL_INTERESTS.filter(i => !selectedInterests.includes(i)).map(interest => (
          <TouchableOpacity 
            key={interest}
            className="px-3.5 py-2 rounded-full bg-slate-100 border border-slate-200"
            onPress={() => onToggleInterest(interest)}
          >
            <Text className="text-sm text-slate-600">
              {interest}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}