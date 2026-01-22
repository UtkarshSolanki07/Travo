import { useRef, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  Keyboard,
} from "react-native";

import MapComponent, { UrlTile, Marker } from "@/components/MapComponent";
import { searchPlaces, reverseGeocode } from "../../services/nominatim";
import debounce from "lodash.debounce";
import { useLocationContext } from "@/context/LocationContext";

const MAP_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY;

export default function Index() {
  const mapRef = useRef<any>(null);
  const { userLocation } = useLocationContext();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);

  // Sync map with user location shared from profile
  useEffect(() => {
    if (userLocation) {
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
        1000
      );
    }
  }, [userLocation]);

  const debouncedSearch = useRef(
    debounce(async (text: string) => {
      if (text.trim().length >= 3) {
        const data = await searchPlaces(text);
        setResults(data);
      } else {
        setResults([]);
      }
    }, 500)
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
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);

    setSelectedPlace({
      name: place.display_name,
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
      800
    );

    setResults([]);
    setQuery(place.display_name);
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
      data?.display_name ||
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
        <UrlTile
          urlTemplate={`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAP_KEY}`}
          maximumZ={19}
        />

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
          placeholder="Search city or place..."
          value={query}
          onChangeText={handleSearch}
          style={styles.input}
        />

        <FlatList
          data={results}
          keyExtractor={(item) => item.place_id.toString()}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => handleSelect(item)}
            >
              <Text numberOfLines={2}>{item.display_name}</Text>
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
