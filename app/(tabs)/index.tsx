import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import MapComponent, { Marker } from "@/components/MapComponent";
import { useLocationContext } from "@/context/LocationContext";
import debounce from "lodash.debounce";
import { reverseGeocode, searchAll } from "../../services/geoapify";

const MAP_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY;

export default function Index() {
  const mapRef = useRef<any>(null);
  const { userLocation } = useLocationContext();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);

  const hasInitialLocation = useRef(false);
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
    <View style={styles.container}>
      <MapComponent
        ref={mapRef}
        style={styles.map}
        onLongPress={handleLongPress}
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

      {/* 🔍 Search Box */}
      <View style={styles.searchBox}>
        <TextInput
          placeholder="Search for a place, cafe, etc..."
          value={query}
          onChangeText={handleSearch}
          style={styles.input}
        />

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => handleSelect(item)}
            >
              <Text numberOfLines={2}>{item.place_name}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  searchBox: {
    position: "absolute",
    top: 50,
    width: "90%",
    alignSelf: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 10,
    elevation: 5,
  },

  input: {
    height: 46,
    borderBottomWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 10,
    marginBottom: 5,
  },

  item: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderColor: "#eee",
  },
});
