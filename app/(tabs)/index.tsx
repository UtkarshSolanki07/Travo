import { useRef, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  Keyboard,
  ActivityIndicator,
  Platform,
  Modal,
  ScrollView,
} from "react-native";

import MapComponent, { Marker } from "@/components/MapComponent";
import { searchAll, reverseGeocode } from "../../services/geoapify";
import debounce from "lodash.debounce";
import { useLocationContext } from "@/context/LocationContext";



export default function Index() {
  const mapRef = useRef<any>(null);
  const { userLocation } = useLocationContext();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [landmarkInfo, setLandmarkInfo] = useState<any>(null);
  const [showLandmarkModal, setShowLandmarkModal] = useState(false);
  const [nearbyLandmarks, setNearbyLandmarks] = useState<any[]>([]);
  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

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

  // Calculate distance between two coordinates (in meters)
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Format category for display
  const formatCategory = (categories: any) => {
    if (!categories) return 'Place';
    if (Array.isArray(categories)) {
      return categories
        .map((cat: string) => cat.split('.').pop()?.replace(/_/g, ' '))
        .join(', ')
        .replace(/\b\w/g, (l: string) => l.toUpperCase());
    }
    return categories.split('.').pop()?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Place';
  };

  // Fetch landmark details when map is tapped
  const fetchLandmarkDetails = async (latitude: number, longitude: number) => {
    try {
      // Search for nearby places/landmarks using GeoApify Places API
      const placesResponse = await fetch(
        `https://api.geoapify.com/v2/places?categories=tourism.attraction,tourism.sights,sport.stadium,entertainment,leisure,building&filter=circle:${longitude},${latitude},500&limit=10&apiKey=${process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY}`
      );

      if (!placesResponse.ok) {
        console.error('Places API request failed');
        return;
      }

      const placesData = await placesResponse.json();

      if (placesData && placesData.features && placesData.features.length > 0) {
        const landmarks = placesData.features;

        // Find the closest landmark
        const closestLandmark = landmarks.reduce((prev: any, curr: any) => {
          const prevDist = getDistance(
            latitude,
            longitude,
            prev.properties.lat,
            prev.properties.lon
          );
          const currDist = getDistance(
            latitude,
            longitude,
            curr.properties.lat,
            curr.properties.lon
          );
          return currDist < prevDist ? curr : prev;
        });

        const distance = getDistance(
          latitude,
          longitude,
          closestLandmark.properties.lat,
          closestLandmark.properties.lon
        );

        // If closest landmark is within 100m, consider it a direct click
        if (distance < 100) {
          setLandmarkInfo({
            name: closestLandmark.properties.name || 'Unknown Place',
            address: closestLandmark.properties.formatted || 'Address not available',
            category: formatCategory(closestLandmark.properties.categories),
            latitude: closestLandmark.properties.lat,
            longitude: closestLandmark.properties.lon,
            distance: Math.round(distance),
            datasource: closestLandmark.properties.datasource?.sourcename || 'Unknown',
            placeId: closestLandmark.properties.place_id,
          });
          setShowLandmarkModal(true);
        } else {
          // Show nearby landmarks
          setNearbyLandmarks(landmarks.map((lm: any) => ({
            name: lm.properties.name || 'Unknown Place',
            category: formatCategory(lm.properties.categories),
            latitude: lm.properties.lat,
            longitude: lm.properties.lon,
            distance: Math.round(getDistance(latitude, longitude, lm.properties.lat, lm.properties.lon)),
          })));
        }
      } else {
        // No landmarks found, show reverse geocode result
        const data = await reverseGeocode(latitude, longitude);
        const name = data?.place_name || `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;

        setSelectedPlace({
          name,
          latitude,
          longitude,
        });
        setQuery(name);
        setResults([]);
      }
    } catch (error) {
      console.error('Error fetching landmark details:', error);
      // Fallback to regular reverse geocoding
      const data = await reverseGeocode(latitude, longitude);
      const name = data?.place_name || `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;

      setSelectedPlace({
        name,
        latitude,
        longitude,
      });
      setQuery(name);
      setResults([]);
    }
  };

  const handleLongPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    setSelectedPlace({
      name: "Loading address...",
      latitude,
      longitude,
    });

    // Fetch landmark details instead of just reverse geocoding
    await fetchLandmarkDetails(latitude, longitude);
  };

  // Handle map press (landmark detection)
  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    setSelectedLocation({
      latitude,
      longitude,
      name: 'Selected Location',
    });

    // Fetch landmark details
    await fetchLandmarkDetails(latitude, longitude);
  };

  // Handle nearby landmark selection
  const handleNearbyLandmarkPress = (landmark: any) => {
    setNearbyLandmarks([]);
    setLandmarkInfo(landmark);
    setShowLandmarkModal(true);

    const newRegion = {
      latitude: landmark.latitude,
      longitude: landmark.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    };

    setRegion(newRegion);
    setSelectedPlace({
      latitude: landmark.latitude,
      longitude: landmark.longitude,
      name: landmark.name,
    });

    if (mapRef.current) {
      mapRef.current.animateToRegion(newRegion, 1000);
    }
  };

  return (
    <View style={styles.container}>
      <MapComponent
        ref={mapRef}
        style={styles.map}
        onLongPress={handleLongPress}
        onPress={handleMapPress}
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

        {/* Show nearby landmarks as markers */}
        {nearbyLandmarks.map((landmark, index) => (
          <Marker
            key={index}
            coordinate={{
              latitude: landmark.latitude,
              longitude: landmark.longitude,
            }}
            title={landmark.name}
            description={landmark.category}
            pinColor="blue"
          />
        ))}
      </MapComponent>

      {/* 🔍 Search Box */}
      <View style={styles.searchBox}>
        <View style={styles.searchInputContainer}>
          <TextInput
            placeholder="Search for a place, cafe, etc..."
            value={query}
            onChangeText={handleSearch}
            onSubmitEditing={() => {
              if (query.trim().length >= 3) {
                debouncedSearch(query);
              }
            }}
            style={styles.input}
            returnKeyType="search"
            placeholderTextColor="#999"
          />
          {loading && (
            <ActivityIndicator
              style={styles.loadingIndicator}
              size="small"
              color="#007AFF"
            />
          )}
          {query.length > 0 && !loading && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setQuery('');
                setResults([]);
                debouncedSearch.cancel();
              }}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

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

      {/* Nearby Landmarks List */}
      {nearbyLandmarks.length > 0 && (
        <View style={styles.nearbyContainer}>
          <Text style={styles.nearbyTitle}>Nearby Landmarks</Text>
          <ScrollView style={styles.nearbyScrollView}>
            {nearbyLandmarks.map((landmark, index) => (
              <TouchableOpacity
                key={index}
                style={styles.nearbyItem}
                onPress={() => handleNearbyLandmarkPress(landmark)}
              >
                <View style={styles.nearbyItemContent}>
                  <Text style={styles.nearbyItemName}>{landmark.name}</Text>
                  <Text style={styles.nearbyItemCategory}>{landmark.category}</Text>
                </View>
                <Text style={styles.nearbyItemDistance}>{landmark.distance}m</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.closeNearbyButton}
            onPress={() => setNearbyLandmarks([])}
          >
            <Text style={styles.closeNearbyButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Landmark Info Modal */}
      <Modal
        visible={showLandmarkModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLandmarkModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📍 Landmark Details</Text>

            {landmarkInfo && (
              <View style={styles.landmarkDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Name:</Text>
                  <Text style={styles.detailValue}>{landmarkInfo.name}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Category:</Text>
                  <Text style={styles.detailValue}>{landmarkInfo.category}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Address:</Text>
                  <Text style={styles.detailValue}>{landmarkInfo.address}</Text>
                </View>

                {landmarkInfo.distance > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Distance:</Text>
                    <Text style={styles.detailValue}>{landmarkInfo.distance}m away</Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Coordinates:</Text>
                  <Text style={styles.detailValue}>
                    {landmarkInfo.latitude.toFixed(6)}, {landmarkInfo.longitude.toFixed(6)}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowLandmarkModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  searchBox: {
    position: "absolute",
    top: Platform.OS === 'ios' ? 60 : 40,
    width: "90%",
    alignSelf: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 10,
    elevation: 5,
  },

  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  input: {
    flex: 1,
    height: 46,
    borderBottomWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 10,
    marginBottom: 5,
  },

  loadingIndicator: {
    position: 'absolute',
    right: 10,
  },

  clearButton: {
    position: 'absolute',
    right: 10,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },

  clearButtonText: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
  },

  item: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderColor: "#eee",
  },

  nearbyContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 998,
  },
  nearbyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  nearbyScrollView: {
    maxHeight: 200,
  },
  nearbyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  nearbyItemContent: {
    flex: 1,
  },
  nearbyItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  nearbyItemCategory: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  nearbyItemDistance: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 10,
  },
  closeNearbyButton: {
    marginTop: 10,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeNearbyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    width: '85%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  landmarkDetails: {
    marginBottom: 20,
  },
  detailRow: {
    marginBottom: 15,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 16,
    color: '#333',
  },
  closeButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
