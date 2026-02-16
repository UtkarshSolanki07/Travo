import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";
import ModeOfTransport from "./ModeOfTransport";

interface LocationInfoCardProps {
  name: string;
  address?: string;
  eta?: string;
  distance?: string;
  distanceKm?: number;
  driveDurationMin?: number;
  onCreateActivity: () => void;
}

export default function LocationInfoCard({
  name,
  address,
  eta,
  distance,
  distanceKm,
  driveDurationMin,
  onCreateActivity,
}: LocationInfoCardProps) {
  return (
    <View className="absolute bottom-6 left-4 right-4 bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 z-50">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-1 mr-4">
          <Text
            className="text-xl font-bold text-slate-900 mb-1"
            numberOfLines={1}
          >
            {name}
          </Text>
          {address && (
            <Text className="text-slate-500 text-sm" numberOfLines={2}>
              {address}
            </Text>
          )}
        </View>
        {(eta || distance) && (
          <View className="items-end">
            {eta && (
              <Text className="text-indigo-600 font-bold text-lg">{eta}</Text>
            )}
            {distance && (
              <Text className="text-slate-400 text-xs font-semibold">
                {distance}
              </Text>
            )}
          </View>
        )}
      </View>

      {distanceKm !== undefined && driveDurationMin !== undefined && (
        <ModeOfTransport
          distanceKm={distanceKm}
          driveDurationMin={driveDurationMin}
        />
      )}

      <TouchableOpacity
        onPress={onCreateActivity}
        className="mt-4 bg-indigo-600 h-14 rounded-2xl flex-row items-center justify-center shadow-lg shadow-indigo-200"
      >
        <Ionicons name="add-circle-outline" size={22} color="white" />
        <Text className="text-white font-bold text-lg ml-2">
          Create a New Activity
        </Text>
      </TouchableOpacity>
    </View>
  );
}
