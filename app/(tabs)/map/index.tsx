import LocationInfoCard from "@/components/LocationInfoCard";
import { SignOutButton } from "@/components/SignOutButton";
import { useMapContext } from "@/context/MapContext";
import { database } from "@/services/database";
import { reverseGeocode, searchAll } from "@/services/geoapify";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import debounce from "lodash.debounce";
import {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";
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
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

// Dummy data for activities (will be replaced in Segment 4)
const DUMMY_ACTIVITIES = [
  {
    id: "1",
    title: "Morning Yoga",
    latitude: 37.78825,
    longitude: -122.4324,
    interest: "Fitness",
  },
  {
    id: "2",
    title: "Coffee Meetup",
    latitude: 37.75825,
    longitude: -122.4624,
    interest: "Social",
  },
];

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
  const trackingSubscription = useRef<any>(null);
  const toggleRequestId = useRef(0);
  const interestsRef = useRef<string[]>([]);

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

  const handleToggleLocation = async (value: boolean) => {
    const previous = isLocationEnabled;
    const currentRequestId = ++toggleRequestId.current;
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
      setIsLocationEnabled(previous);
    }
  };

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

  // Centering effect
  useEffect(() => {
    const target = selectedLocation || userLocation;
    if (target) {
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

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined} // Google Maps on Android, Apple Maps on iOS
        style={{ flex: 1 }}
        onLongPress={handleLongPress}
        initialRegion={fallbackRegion}
      >
        {userLocation && (
          <Marker
            coordinate={userLocation}
            title="My Location"
            pinColor="blue"
          />
        )}
        {selectedLocation && (
          <Marker
            coordinate={selectedLocation}
            title={selectedLocation.name || "Selected"}
            pinColor="red"
          />
        )}
        {DUMMY_ACTIVITIES.map((activity) => (
          <Marker
            key={activity.id}
            coordinate={{
              latitude: activity.latitude,
              longitude: activity.longitude,
            }}
            title={activity.title}
            description={activity.interest}
            pinColor="green"
          />
        ))}
      </MapView>

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
            keyExtractor={(item) => item.id}
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
          name={selectedLocation.name}
          address={selectedLocation.formattedAddress}
          onCreateActivity={() => {
            // Navigate to activities/create passing the selected location
            router.push({
              pathname: "/activities",
              params: {
                lat: selectedLocation.latitude,
                lon: selectedLocation.longitude,
                name: selectedLocation.name,
                address: selectedLocation.formattedAddress,
              },
            });
          }}
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
    </View>
  );
};

export default MapScreen;
