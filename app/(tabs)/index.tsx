import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import MapComponent, { Marker } from "@/components/MapComponent";
import { SignOutButton } from "@/components/SignOutButton";
import { useMapContext } from "@/context/MapContext";
import { database } from "@/services/database";
import { LOCATION_TASK_NAME } from "@/services/locationTask";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import debounce from "lodash.debounce";
import { reverseGeocode, searchAll } from "../../services/geoapify";

/**
 * Main map screen component that renders the interactive map, search UI, and live-tracking controls.
 *
 * @returns A JSX element rendering the map screen and its associated UI (search, markers, and menu).
 */
export default function Index() {
  const mapRef = useRef<any>(null);
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { userLocation, setUserLocation: updateLocation } = useMapContext();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);

  const hasInitialLocation = useRef(false);
  const trackingSubscription = useRef<any>(null); // For foreground fallback
  const interestsRef = useRef<string[]>([]);
  const toggleRequestId = useRef(0);
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

  useEffect(() => {
    (async () => {
      try {
        const isRegistered =
          await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isRegistered) {
          // console.log("Stopping lingering background location task...");
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
      } catch (e) {
        console.error("Failed to stop lingering background location task", e);
      }
    })();
  }, []);

  const handleToggleLocation = async (value: boolean) => {
    const previous = isLocationEnabled;
    const currentRequestId = ++toggleRequestId.current;

    // Optimistic update
    setIsLocationEnabled(value);

    if (!clerkUser) {
      if (value) {
        setIsLocationEnabled(false);
      }
      return;
    }

    try {
      if (value) {
        // Start Tracking
        const { status: fgStatus } =
          await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== "granted") {
          throw new Error("Foreground location permission denied");
        }

        // Start Foreground Watch immediately (works in Expo Go)
        await startForegroundWatch(clerkUser.id);

        // Background Tracking disabled for now
        /*
        try {
          const { status: bgStatus } =
            await Location.requestBackgroundPermissionsAsync();
          if (bgStatus === "granted") {
            // ...
          }
        } catch (bgError) {
          console.warn("Background tracking failed", bgError);
        }
        */

        await database.updateProfile(clerkUser.id, {
          is_live_tracking: true,
          interests: interestsRef.current || [],
        });
      } else {
        // Stop Tracking
        if (trackingSubscription.current) {
          trackingSubscription.current.remove();
          trackingSubscription.current = null;
        }

        // Stop background task if it was running (to clear notification)
        const isRegistered =
          await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isRegistered) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }

        await database.updateProfile(clerkUser.id, {
          is_live_tracking: false,
          interests: interestsRef.current || [],
        });

        await SecureStore.deleteItemAsync("current_user_id");
      }
    } catch (error) {
      console.error("Failed to toggle tracking", error);
      setIsLocationEnabled(previous); // Revert UI
      return;
    }

    if (currentRequestId !== toggleRequestId.current) {
      return;
    }
  };

  // Sync map with user location shared from profile
  useEffect(() => {
    if (userLocation && !hasInitialLocation.current) {
      hasInitialLocation.current = true;
      setSelectedPlace({
        name: "My Location",
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      });
      mapRef.current?.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        1000,
      );
    }
  }, [userLocation]);

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
      setSelectedPlace(null);

      const targetLocation = userLocation || fallbackRegion;
      mapRef.current?.animateToRegion(
        {
          latitude: targetLocation.latitude,
          longitude: targetLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        1000,
      );
    } else {
      debouncedSearch(text);
    }
  };

  const handleSelect = (place: any) => {
    if (!place.center || place.center.length < 2) {
      console.warn("Invalid place data:", place);
      return;
    }
    const [lon, lat] = place.center;
    setSelectedPlace({
      name: place.place_name,
      latitude: lat,
      longitude: lon,
    });

    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lon,
        latitudeDelta: 0.3,
        longitudeDelta: 0.3,
      },
      800,
    );

    setResults([]);
    setQuery(place.place_name);
    Keyboard.dismiss();
  };

  const handleLongPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    setSelectedPlace({
      name: "Loading address...",
      latitude,
      longitude,
    });

    const data = await reverseGeocode(latitude, longitude);
    const name =
      data?.place_name ||
      `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;

    setSelectedPlace({
      name,
      latitude,
      longitude,
    });

    setQuery(name);
    setResults([]);
  };

  return (
    <View className="flex-1">
      <MapComponent
        ref={mapRef}
        className="flex-1"
        onLongPress={handleLongPress}
        initialRegion={
          userLocation
            ? {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }
            : fallbackRegion
        }
      >
        {userLocation && (
          <Marker
            coordinate={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }}
            title="My Location"
            pinColor="blue"
          />
        )}
        {selectedPlace && (
          <Marker
            coordinate={{
              latitude: selectedPlace.latitude,
              longitude: selectedPlace.longitude,
            }}
            title={selectedPlace.name}
          />
        )}
      </MapComponent>

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

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          className="mt-2 max-h-56"
          renderItem={({ item }) => (
            <TouchableOpacity
              className="border-b border-slate-100 py-3"
              onPress={() => handleSelect(item)}
            >
              <Text className="text-sm text-slate-700" numberOfLines={2}>
                {item.place_name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

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
                Sign in to access more settings
              </Text>
            </TouchableOpacity>
          )}

          <View className="mt-3 flex-row items-start">
            <View className="mr-2 mt-0.5">
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#94a3b8"
              />
            </View>
            <Text className="text-xs text-slate-400">
              Your approximate location is shared, not your exact address.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}