import ActivityCard from "@/components/ActivityCard";
import ActivityDetailsModal from "@/components/ActivityDetailsModal";
import { useMapContext } from "@/context/MapContext";
import { database, type Activity } from "@/services/database";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Tab = "nearby" | "my_activities" | "joined";

const ActivitiesScreen = () => {
  const { user } = useUser();
  const { userLocation } = useMapContext();
  const [activeTab, setActiveTab] = useState<Tab>("nearby");
  const [nearbyActivities, setNearbyActivities] = useState<Activity[]>([]);
  const [myActivities, setMyActivities] = useState<Activity[]>([]);
  const [joinedActivities, setJoinedActivities] = useState<Activity[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null,
  );

  const fetchNearbyActivities = useCallback(async () => {
    if (!userLocation) return;

    try {
      const activities = await database.getActivities({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        radiusKm: 50,
        status: "upcoming",
      });
      setNearbyActivities(activities);
    } catch (error) {
      console.error("Failed to fetch nearby activities:", error);
    }
  }, [userLocation]);

  const fetchUserActivities = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { created, joined } = await database.getUserActivities(user.id);
      setMyActivities(created);
      setJoinedActivities(joined);
    } catch (error) {
      console.error("Failed to fetch user activities:", error);
    }
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchNearbyActivities(), fetchUserActivities()]);
    setRefreshing(false);
  }, [fetchNearbyActivities, fetchUserActivities]);

  useFocusEffect(
    useCallback(() => {
      fetchNearbyActivities();
      fetchUserActivities();
    }, [fetchNearbyActivities, fetchUserActivities]),
  );

  const getDisplayActivities = () => {
    switch (activeTab) {
      case "nearby":
        return nearbyActivities;
      case "my_activities":
        return myActivities;
      case "joined":
        return joinedActivities;
      default:
        return [];
    }
  };

  const calculateDistance = (activity: Activity) => {
    if (!userLocation) return undefined;
    return database.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      activity.latitude,
      activity.longitude,
    );
  };

  const handleActivityPress = (activity: Activity) => {
    setSelectedActivity(activity);
    // TODO: Open ActivityDetailsModal
    console.log("Activity pressed:", activity.title);
  };

  const renderActivity = ({ item }: { item: Activity }) => (
    <ActivityCard
      activity={item}
      onPress={() => handleActivityPress(item)}
      distance={calculateDistance(item)}
      participantCount={0} // TODO: Fetch actual participant count
      isJoined={activeTab === "joined"}
    />
  );

  const renderEmptyState = () => {
    let message = "";
    let icon: keyof typeof Ionicons.glyphMap = "location-outline";

    switch (activeTab) {
      case "nearby":
        message = userLocation
          ? "No activities nearby. Be the first to create one!"
          : "Enable location to see nearby activities";
        icon = "location-outline";
        break;
      case "my_activities":
        message = "You haven't created any activities yet";
        icon = "add-circle-outline";
        break;
      case "joined":
        message = "You haven't joined any activities yet";
        icon = "people-outline";
        break;
    }

    return (
      <View className="flex-1 items-center justify-center px-8 py-12">
        <Ionicons name={icon} size={64} color="#cbd5e1" />
        <Text className="text-center text-slate-500 mt-4 text-base">
          {message}
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="bg-white border-b border-slate-200 pt-12 pb-4 px-4">
        <Text className="text-2xl font-bold text-slate-900 mb-4">
          Activities
        </Text>

        {/* Tabs */}
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => setActiveTab("nearby")}
            className={`flex-1 py-2 rounded-lg ${
              activeTab === "nearby" ? "bg-indigo-600" : "bg-slate-100"
            }`}
          >
            <Text
              className={`text-center font-semibold text-sm ${
                activeTab === "nearby" ? "text-white" : "text-slate-600"
              }`}
            >
              Nearby
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("my_activities")}
            className={`flex-1 py-2 rounded-lg ${
              activeTab === "my_activities" ? "bg-indigo-600" : "bg-slate-100"
            }`}
          >
            <Text
              className={`text-center font-semibold text-sm ${
                activeTab === "my_activities" ? "text-white" : "text-slate-600"
              }`}
            >
              My Activities
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("joined")}
            className={`flex-1 py-2 rounded-lg ${
              activeTab === "joined" ? "bg-indigo-600" : "bg-slate-100"
            }`}
          >
            <Text
              className={`text-center font-semibold text-sm ${
                activeTab === "joined" ? "text-white" : "text-slate-600"
              }`}
            >
              Joined
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Activities List */}
      <FlatList
        data={getDisplayActivities()}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
      <ActivityDetailsModal
        activity={selectedActivity}
        visible={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
    </View>
  );
};

export default ActivitiesScreen;
