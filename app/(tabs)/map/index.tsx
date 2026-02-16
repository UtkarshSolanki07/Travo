import ActivityDetailsModal from "@/components/ActivityDetailsModal";
import CreateActivityModal from "@/components/CreateActivityModal";
import LocationInfoCard from "@/components/LocationInfoCard";
import { SignOutButton } from "@/components/SignOutButton";
import { useMapContext } from "@/context/MapContext";
import { database, type Activity } from "@/services/database";
import { reverseGeocode, searchAll } from "@/services/geoapify";
import { getRoute, LatLng } from "@/services/routes";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import debounce from "lodash.debounce";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

const MapScreen = () => {
  const {
    userLocation,
    selectedLocation,
    setSelectedLocation,
    setUserLocation: updateLocation,
  } = useMapContext();
  const mapRef = useRef<MapView>(null);
  const router = useRouter();
  const { user: clerkUser } = useUser();

  // Local UI States
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [route, setRoute] = useState<{
    points: LatLng[];
    distanceKm: number;
    durationMin: number;
  } | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null,
  );
  const hasInitialized = useRef(false);
  const hasCentered = useRef(false);
  const trackingSubscription = useRef<any>(null);

  useEffect(() => {
    return () => {
      console.log("MapScreen unmounting, cleaning up subscription");
      if (trackingSubscription.current) {
        trackingSubscription.current.remove();
        trackingSubscription.current = null;
      }
    };
  }, []);

  useEffect(() => {
    console.log("Selected Location changed:", selectedLocation);
  }, [selectedLocation]);

  useEffect(() => {
    console.log("Route changed:", !!route);
  }, [route]);

  const interestsRef = useRef<string[]>([]);
  const lastRoutePosition = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const lastRouteTimestamp = useRef<number>(0);
  const lastSelectedLocationId = useRef<string | null>(null);
  const ROUTE_DISTANCE_THRESHOLD = 0.05; // 50m
  const ROUTE_TIME_THRESHOLD = 15000; // 15s

  const fallbackRegion = {
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const startForegroundWatch = useCallback(
    async (userId: string) => {
      if (trackingSubscription.current) return;
      try {
        trackingSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 10000,
            distanceInterval: 50,
          },
          async (location) => {
            updateLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
            try {
              await database.updateLiveLocation(
                userId,
                location.coords.latitude,
                location.coords.longitude,
                interestsRef.current,
              );
            } catch (err) {
              console.error("Foreground DB update failed", err);
            }
          },
        );
      } catch (e) {
        console.error("Failed to start foreground watch", e);
      }
    },
    [updateLocation],
  );

  const handleToggleLocation = useCallback(
    async (value: boolean) => {
      setIsLocationEnabled(value);

      if (!clerkUser) {
        if (value) setIsLocationEnabled(false);
        return;
      }

      try {
        if (value) {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") throw new Error("Permission denied");
          await startForegroundWatch(clerkUser.id);
          await database.updateProfile(clerkUser.id, {
            is_live_tracking: true,
            interests: interestsRef.current || [],
          });
        } else {
          if (trackingSubscription.current) {
            trackingSubscription.current.remove();
            trackingSubscription.current = null;
          }
          await database.updateProfile(clerkUser.id, {
            is_live_tracking: false,
            interests: interestsRef.current || [],
          });
          await SecureStore.deleteItemAsync("current_user_id");
        }
      } catch (error) {
        console.error("Toggle location failed", error);
        setIsLocationEnabled(false);
      }
    },
    [clerkUser, startForegroundWatch],
  );

  const debouncedSearch = useRef(
    debounce(async (text: string) => {
      if (text.trim().length >= 3) {
        const data = await searchAll(text, userLocation || undefined);
        setResults(data);
      } else {
        setResults([]);
      }
    }, 500),
  ).current;

  const handleSearch = (text: string) => {
    setQuery(text);
    if (text.trim().length === 0) {
      setResults([]);
      debouncedSearch.cancel();
      setSelectedLocation(null);

      const target = userLocation || fallbackRegion;
      mapRef.current?.animateToRegion(
        {
          ...target,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        1000,
      );
    } else {
      debouncedSearch(text);
    }
  };

  const handleSelectPlace = (place: any) => {
    const [lon, lat] = place.center;
    const newLocation = {
      latitude: lat,
      longitude: lon,
      name: place.place_name,
      formattedAddress: place.place_name,
    };
    setSelectedLocation(newLocation);
    setResults([]);
    setQuery(place.place_name);
    Keyboard.dismiss();
  };

  const handlePoiClick = (event: any) => {
    const { coordinate, name } = event.nativeEvent;
    setSelectedLocation({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      name: name,
      formattedAddress: name,
    });
    setQuery(name);
  };

  const handleLongPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const data = await reverseGeocode(latitude, longitude);
    const name =
      data?.place_name ||
      `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;

    setSelectedLocation({
      latitude,
      longitude,
      name,
      formattedAddress: data?.place_name,
    });
    setQuery(name);
    setResults([]);
  };

  // Initialization Effect
  useEffect(() => {
    if (!clerkUser || hasInitialized.current) return;

    const init = async () => {
      hasInitialized.current = true;
      try {
        // 1. Get current position immediately to seed the map
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          updateLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }

        // 2. Sync profile and resume tracking if needed
        const profile = await database.getProfile(clerkUser.id);
        if (profile) {
          interestsRef.current = profile.interests || [];
          if (profile.is_live_tracking) {
            handleToggleLocation(true);
          }
        }
      } catch (e) {
        console.error("App init failed", e);
      }
    };

    init();
  }, [clerkUser, handleToggleLocation, updateLocation]);

  // Centering effect (Only once automatically)
  useEffect(() => {
    const target = selectedLocation || userLocation;
    if (target && !hasCentered.current) {
      hasCentered.current = true;
      mapRef.current?.animateToRegion(
        {
          latitude: target.latitude,
          longitude: target.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        1000,
      );
    }
  }, [selectedLocation, userLocation]);

  const recenter = () => {
    const target = userLocation || fallbackRegion;
    mapRef.current?.animateToRegion(
      {
        latitude: target.latitude,
        longitude: target.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      800,
    );
  };

  const lastActivityFetchPosition = useRef<{ latitude: number; longitude: number } | null>(null);
const ACTIVITY_FETCH_DISTANCE_THRESHOLD = 0.5; // 500m

  const fetchActivities = useCallback(async () => {
    if (!userLocation) return;
    if (lastActivityFetchPosition.current) {
    const dist = database.calculateDistance(
       lastActivityFetchPosition.current.latitude,
       lastActivityFetchPosition.current.longitude,
       userLocation.latitude,
       userLocation.longitude,
     );
     if (dist < ACTIVITY_FETCH_DISTANCE_THRESHOLD) return;
   }

    try {
      const fetchedActivities = await database.getActivities({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        radiusKm: 50,
        status: "upcoming",
      });
      setActivities(fetchedActivities);
      lastActivityFetchPosition.current = { ...userLocation };
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    }
  }, [userLocation]);

  // Fetch when location changes
  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Refresh when tab focused
  useFocusEffect(
    useCallback(() => {
      fetchActivities();
      if (clerkUser) {
        database.getProfile(clerkUser.id).then((profile) => {
          if (profile) interestsRef.current = profile.interests || [];
        });
      }
    }, [fetchActivities, clerkUser]),
  );

  const handleActivityCreated = () => {
    fetchActivities();
  };

  // Route fetching logic
  useEffect(() => {
    if (!userLocation || !selectedLocation) {
      setRoute(null);
      lastRoutePosition.current = null;
      lastRouteTimestamp.current = 0;
      lastSelectedLocationId.current = null;
      return;
    }

    const run = async () => {
      const now = Date.now();
      const timeSinceLastFetch = now - lastRouteTimestamp.current;
      const selectedId =
        selectedLocation.formattedAddress ||
        `${selectedLocation.latitude}-${selectedLocation.longitude}`;
      const destinationChanged = selectedId !== lastSelectedLocationId.current;

      if (!destinationChanged && lastRoutePosition.current) {
        const distanceMoved = database.calculateDistance(
          lastRoutePosition.current.latitude,
          lastRoutePosition.current.longitude,
          userLocation.latitude,
          userLocation.longitude,
        );

        if (
          distanceMoved < ROUTE_DISTANCE_THRESHOLD &&
          timeSinceLastFetch < ROUTE_TIME_THRESHOLD
        ) {
          return;
        }
      }

      const result = await getRoute(
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
        },
      );
      setRoute(result);
      lastRoutePosition.current = {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      };
      lastRouteTimestamp.current = now;
      lastSelectedLocationId.current = selectedId;
    };

    run();
  }, [userLocation, selectedLocation]);

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        style={{ flex: 1 }}
        onLongPress={handleLongPress}
        onPoiClick={handlePoiClick}
        initialRegion={fallbackRegion}
        showsTraffic={true}
        showsUserLocation={true}
        showsMyLocationButton={false} // We add our own
      >
        {selectedLocation && (
          <Marker
            coordinate={selectedLocation}
            title={selectedLocation.name || "Selected"}
            pinColor="red"
          />
        )}
        {route && (
          <>
            {/* Border/shadow layer for depth and visibility */}
            <Polyline
              coordinates={route.points}
              strokeWidth={10}
              strokeColor="rgba(79, 70, 229, 0.2)"
              lineCap="round"
              lineJoin="round"
            />
            {/* White outline for contrast */}
            <Polyline
              coordinates={route.points}
              strokeWidth={7}
              strokeColor="#ffffff"
              lineCap="round"
              lineJoin="round"
            />
            {/* Main route line - bold and vibrant */}
            <Polyline
              coordinates={route.points}
              strokeWidth={5}
              strokeColor="#4f46e5"
              lineCap="round"
              lineJoin="round"
            />
          </>
        )}
        {activities.map((activity) => (
          <Marker
            key={activity.id}
            coordinate={{
              latitude: activity.latitude,
              longitude: activity.longitude,
            }}
            title={activity.title}
            description={activity.activity_type || activity.interests?.[0]}
            pinColor="green"
            onPress={() => {
              setSelectedActivity(activity);
              setSelectedLocation({
                latitude: activity.latitude,
                longitude: activity.longitude,
                name: activity.title,
                formattedAddress: activity.city || activity.activity_type || "",
              });
              setQuery(activity.title);
            }}
          />
        ))}
      </MapView>

      <ActivityDetailsModal
        activity={selectedActivity}
        visible={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />

      {/* Recenter Button */}
      <View className="absolute right-4 bottom-32 z-30">
        <TouchableOpacity
          className="h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg"
          onPress={recenter}
        >
          <Ionicons name="locate" size={24} color="#6366f1" />
        </TouchableOpacity>
      </View>

      {/* Floating Menu Toggle */}
      <View className="absolute right-4 top-12 z-30">
        <TouchableOpacity
          className="h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg"
          onPress={() => setIsMenuOpen(true)}
        >
          <Ionicons name="menu" size={24} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {/* Search Box */}
      <View className="absolute left-4 right-16 top-12 z-20 rounded-2xl bg-white/95 p-3 shadow-lg">
        <TextInput
          placeholder="Search for a place, cafe, etc..."
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={handleSearch}
          className="h-11 rounded-xl bg-slate-100 px-4 text-base text-slate-900"
        />
        {results.length > 0 && (
          <FlatList
            data={results}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            keyboardShouldPersistTaps="handled"
            className="mt-2 max-h-56"
            renderItem={({ item }) => (
              <TouchableOpacity
                className="border-b border-slate-100 py-3"
                onPress={() => handleSelectPlace(item)}
              >
                <Text className="text-sm text-slate-700" numberOfLines={2}>
                  {item.place_name}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Info Card */}
      {selectedLocation && (
        <LocationInfoCard
          name={selectedLocation.name || "Selected Location"}
          address={selectedLocation.formattedAddress}
          eta={route ? `${Math.round(route.durationMin)} min` : undefined}
          distance={route ? `${route.distanceKm.toFixed(1)} km` : undefined}
          distanceKm={route?.distanceKm}
          driveDurationMin={route?.durationMin}
          onCreateActivity={() => setIsCreateModalVisible(true)}
        />
      )}

      {/* Menu Modal */}
      <Modal transparent visible={isMenuOpen} animationType="fade">
        <Pressable
          className="flex-1 bg-slate-900/20"
          onPress={() => setIsMenuOpen(false)}
        />
        <View className="absolute right-4 top-24 w-72 rounded-2xl bg-white p-4 shadow-xl">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-slate-900">
              Map Menu
            </Text>
            <TouchableOpacity onPress={() => setIsMenuOpen(false)}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>
          <View className="mb-3 rounded-xl bg-slate-50 px-3 py-3">
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Quick Settings
            </Text>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons name="location-outline" size={20} color="#6366f1" />
                <Text className="ml-2 text-sm font-semibold text-slate-800">
                  Live Tracking
                </Text>
              </View>
              <Switch
                trackColor={{ false: "#e2e8f0", true: "#a5b4fc" }}
                thumbColor={isLocationEnabled ? "#6366f1" : "#f1f5f9"}
                onValueChange={handleToggleLocation}
                value={isLocationEnabled}
                disabled={!clerkUser}
              />
            </View>
          </View>
          <TouchableOpacity
            className="flex-row items-center justify-between py-3"
            onPress={() => {
              setIsMenuOpen(false);
              router.push("/profile");
            }}
          >
            <View className="flex-row items-center">
              <Ionicons name="person-outline" size={20} color="#6366f1" />
              <Text className="ml-2 text-sm font-semibold text-slate-800">
                Account Settings
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
          </TouchableOpacity>
          {clerkUser ? (
            <View className="mt-2 rounded-xl bg-slate-50">
              <SignOutButton />
            </View>
          ) : (
            <TouchableOpacity
              className="mt-2 rounded-xl bg-indigo-50 px-4 py-3"
              onPress={() => {
                setIsMenuOpen(false);
                router.push("/sign-in");
              }}
            >
              <Text className="text-sm font-semibold text-indigo-600">
                Sign in for more
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      {/* Create Activity Modal */}
      <CreateActivityModal
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        initialLocation={
          selectedLocation
            ? {
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                city: selectedLocation.formattedAddress,
              }
            : userLocation
              ? {
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                  city: undefined,
                }
              : undefined
        }
        onActivityCreated={handleActivityCreated}
      />
    </View>
  );
};

export default MapScreen;
