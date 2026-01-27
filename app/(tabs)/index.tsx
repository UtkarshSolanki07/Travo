import React, { useRef, useState, useEffect } from "react";
import {
  View,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  Keyboard,
} from "react-native";

import MapComponent, { UrlTile, Marker } from "@/components/MapComponent";
import { searchAll, reverseGeocode } from "../../services/googlemaps";
import debounce from "lodash.debounce";
import { useLocationContext } from "@/context/LocationContext";

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
        1000
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
    if (!place.center || place.center.length < 2) {
      console.warn('Invalid place data:', place);
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
      800
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
        style={{ flex: 1 }} 
        onLongPress={handleLongPress}
      >
        <UrlTile
          urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
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
      <View className="absolute top-[50px] w-[90%] self-center bg-white rounded-xl p-2.5 shadow-md">
        <TextInput
          placeholder="Search for a place, cafe, etc..."
          value={query}
          onChangeText={handleSearch}
          className="h-[46px] border-b border-slate-200 px-2.5 mb-1.5"
        />

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              className="py-2.5 border-b border-slate-100"
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
