import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native'
import { User } from '@/services/database'

interface EditProfileFormProps {
  editingData: Partial<User>
  saving: boolean
  onDataChange: (data: Partial<User>) => void
  onSave: () => void
  onCancel: () => void
}

export default function EditProfileForm({
  editingData,
  saving,
  onDataChange,
  onSave,
  onCancel
}: EditProfileFormProps) {
  return (
    <View className="w-full px-2.5">
      <TextInput
        className="bg-white border border-slate-200 rounded-xl p-3 mb-3 text-base text-slate-800"
        placeholder="Display Name"
        value={editingData.display_name || ''}
        onChangeText={(text) => onDataChange({ ...editingData, display_name: text })}
      />
      <TextInput
        className="bg-white border border-slate-200 rounded-xl p-3 mb-3 text-base text-slate-800 h-20"
        placeholder="Bio"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        value={editingData.bio || ''}
        onChangeText={(text) => onDataChange({ ...editingData, bio: text })}
      />
      <View className="flex-row mb-3">
        <TextInput
          className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-base text-slate-800 mr-2"
          placeholder="City"
          value={editingData.city || ''}
          onChangeText={(text) => onDataChange({ ...editingData, city: text })}
        />
        <TextInput
          className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-base text-slate-800"
          placeholder="Country"
          value={editingData.country || ''}
          onChangeText={(text) => onDataChange({ ...editingData, country: text })}
        />
      </View>
      <View className="flex-row gap-3 mt-2">
        <TouchableOpacity 
          className="flex-1 p-3.5 rounded-xl items-center bg-slate-100" 
          onPress={onCancel}
        >
          <Text className="text-slate-600 font-semibold">Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className="flex-1 p-3.5 rounded-xl items-center bg-indigo-500" 
          onPress={onSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold">Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}