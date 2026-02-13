import type { Activity } from "@/services/database";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { Text, TouchableOpacity, View } from "react-native";

interface ActivityCardProps {
  activity: Activity;
  onPress: () => void;
  distance?: number; // in km
  participantCount?: number;
  isJoined?: boolean;
  isPending?: boolean;
}

export default function ActivityCard({
  activity,
  onPress,
  distance,
  participantCount = 0,
  isJoined = false,
  isPending = false,
}: ActivityCardProps) {
  const startTime = new Date(activity.start_time);
  const now = new Date();
  const isUpcoming = startTime > now;
  const timeUntil = isUpcoming
    ? Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60 * 60))
    : 0;

  const getSizeIcon = () => {
    switch (activity.size_type) {
      case "duo":
        return "people-outline";
      case "trio":
        return "people-outline";
      case "group":
        return "people-circle-outline";
      default:
        return "people-outline";
    }
  };

  const getStatusColor = () => {
    switch (activity.status) {
      case "upcoming":
        return "bg-blue-100 text-blue-700";
      case "ongoing":
        return "bg-green-100 text-green-700";
      case "completed":
        return "bg-gray-100 text-gray-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-slate-100"
    >
      {/* Header */}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-2">
          <Text className="text-lg font-bold text-slate-900" numberOfLines={1}>
            {activity.title}
          </Text>
          {activity.activity_type && (
            <Text className="text-xs text-indigo-600 font-semibold mt-1">
              {activity.activity_type}
            </Text>
          )}
        </View>
        <View className={`px-2 py-1 rounded-lg ${getStatusColor()}`}>
          <Text className="text-xs font-semibold capitalize">
            {activity.status}
          </Text>
        </View>
      </View>

      {/* Description */}
      {activity.description && (
        <Text className="text-sm text-slate-600 mb-3" numberOfLines={2}>
          {activity.description}
        </Text>
      )}

      {/* Info Row */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <Ionicons name="time-outline" size={16} color="#64748b" />
          <Text className="text-xs text-slate-600 ml-1">
            {format(startTime, "MMM d, h:mm a")}
          </Text>
        </View>
        {distance !== undefined && (
          <View className="flex-row items-center">
            <Ionicons name="location-outline" size={16} color="#64748b" />
            <Text className="text-xs text-slate-600 ml-1">
              {distance < 1
                ? `${Math.round(distance * 1000)}m`
                : `${distance.toFixed(1)}km`}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Row */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center space-x-3">
          <View className="flex-row items-center">
            <Ionicons name={getSizeIcon()} size={18} color="#6366f1" />
            <Text className="text-xs text-slate-700 ml-1 font-semibold">
              {participantCount}/{activity.max_participants}
            </Text>
          </View>
          {isUpcoming && timeUntil > 0 && (
            <Text className="text-xs text-slate-500">in {timeUntil}h</Text>
          )}
        </View>

        {/* Join Status Badge */}
        {isJoined && (
          <View className="bg-green-100 px-2 py-1 rounded-lg">
            <Text className="text-xs font-semibold text-green-700">Joined</Text>
          </View>
        )}
        {isPending && (
          <View className="bg-yellow-100 px-2 py-1 rounded-lg">
            <Text className="text-xs font-semibold text-yellow-700">
              Pending
            </Text>
          </View>
        )}
      </View>

      {/* Interests Tags */}
      {activity.interests && activity.interests.length > 0 && (
        <View className="flex-row flex-wrap mt-3 gap-2">
          {activity.interests.slice(0, 3).map((interest, index) => (
            <View key={index} className="bg-indigo-50 px-2 py-1 rounded-lg">
              <Text className="text-xs text-indigo-700">{interest}</Text>
            </View>
          ))}
          {activity.interests.length > 3 && (
            <View className="bg-slate-100 px-2 py-1 rounded-lg">
              <Text className="text-xs text-slate-600">
                +{activity.interests.length - 3}
              </Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}
