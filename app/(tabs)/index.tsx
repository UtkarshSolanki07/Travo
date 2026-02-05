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
import { useLocationContext } from "@/context/LocationContext";
import debounce from "lodash.debounce";
import { reverseGeocode, searchAll } from "../../services/geoapify";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import type { LocationSubscription } from "expo-location";
import { database } from "@/services/database";
import { SignOutButton } from "@/components/SignOutButton";


/**
 * Main map screen that displays an interactive map with search, place selection, long-press reverse geocoding, and live location controls.
 *
 * This component renders a full-screen map with a searchable place list, a selectable marker, and a menu for account and quick settings (including a live tracking toggle that requests permissions and updates the user's live location in the database). It also synchronizes initial shared location from the user's profile and supports starting/stopping foreground location tracking.
 *
 * @returns A React element rendering the map interface with search results, selectable markers, and a settings menu including live-tracking controls.
 */
export default function Index() {
  const mapRef = useRef<any>(null);
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const { userLocation, updateLocation } = useLocationContext();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);

  const hasInitialLocation = useRef(false);
  const trackingSubscription = useRef<LocationSubscription | null>(null);
  const interestsRef = useRef<string[]>([]);
  const userIdRef = useRef<string | null>(null);
  const fallbackRegion = {
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  useEffect(() => {
    userIdRef.current = clerkUser?.id ?? null;
  }, [clerkUser]);

  const stopTracking = useCallback(() => {
    if (trackingSubscription.current) {
      trackingSubscription.current.remove();
      trackingSubscription.current = null;
    }
  }, []);

  const startTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setIsLocationEnabled(false);
        return;
      }

      if (trackingSubscription.current) {
        trackingSubscription.current.remove();
      }

      trackingSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 25,
          timeInterval: 10000,
        },
        async (location) => {
          const { latitude, longitude } = location.coords;
          updateLocation(latitude, longitude);

          const userId = userIdRef.current;
          if (userId) {
            try {
              await database.updateLiveLocation(
                userId,
                latitude,
                longitude,
                interestsRef.current,
              );
            } catch (err) {
              console.error("Failed to update live location", err);
            }
          }
        },
      );
    } catch (error) {
      console.error("Error in tracking:", error);
      setIsLocationEnabled(false);
    }
  }, [updateLocation]);

  const loadSettings = useCallback(async () => {
    if (!clerkUser) return;

    setIsSettingsLoading(true);
    try {
      const profile = await database.getProfile(clerkUser.id);

      if (profile) {
        const enabled = !!profile.is_live_tracking;
        setIsLocationEnabled(enabled);
        interestsRef.current = profile.interests || [];

        if (enabled) {
          await startTracking();
        }
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setIsSettingsLoading(false);
    }
  }, [clerkUser, startTracking]);

  useEffect(() => {
    if (clerkUser) {
      loadSettings();
    }

    return () => {
      stopTracking();
    };
  }, [clerkUser, loadSettings, stopTracking]);

  const handleToggleLocation = async (value: boolean) => {
    const previous = isLocationEnabled;
    setIsLocationEnabled(value);

    if (!clerkUser) return;

    try {
      await database.updateProfile(clerkUser.id, {
        is_live_tracking: value,
        interests: interestsRef.current,
      });
    } catch (error) {
      console.error("Failed to update tracking status", error);
      setIsLocationEnabled(previous);
      return;
    }

    if (value) {
      await startTracking();
    } else {
      stopTracking();
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
                disabled={isSettingsLoading || !clerkUser}
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