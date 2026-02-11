import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

interface LocationInfoCardProps {
  name?: string;
  address?: string;
  onCreateActivity: () => void;
}

export default function LocationInfoCard({
  name,
  address,
  onCreateActivity,
}: LocationInfoCardProps) {
  return (
    <View className="absolute bottom-6 left-4 right-4 bg-white rounded-3xl p-5 shadow-2xl border border-slate-100">
      <View className="flex-row items-start justify-between mb-4">
        <View className="flex-1">
          <Text
            className="text-xl font-bold text-slate-900 mb-1"
            numberOfLines={1}
          >
            {name || "Selected Location"}
          </Text>
          <View className="flex-row items-center">
            <Ionicons name="location-sharp" size={14} color="#64748b" />
            <Text className="text-sm text-slate-500 ml-1" numberOfLines={2}>
              {address || "No address available"}
            </Text>
          </View>
        </View>
        <View className="bg-indigo-50 p-2 rounded-xl">
          <Ionicons name="navigate" size={20} color="#6366f1" />
        </View>
      </View>

      <TouchableOpacity
        onPress={onCreateActivity}
        className="bg-indigo-600 h-14 rounded-2xl flex-row items-center justify-center shadow-lg shadow-indigo-200"
      >
        <Ionicons name="add-circle-outline" size={22} color="white" />
        <Text className="text-white font-bold text-lg ml-2">
          Create a New Activity
        </Text>
      </TouchableOpacity>
    </View>
  );
}
