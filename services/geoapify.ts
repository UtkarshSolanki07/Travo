const GEOAPIFY_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY;

export interface GeoApifyFeature {
  place_id: string;
  name?: string;
  formatted: string;
  address_line1?: string;
  address_line2?: string;
  category?: string;
  result_type?: string;
  city?: string;
  country?: string;
  country_code?: string;
  state?: string;
  district?: string;
  county?: string;
  county_code?: string;
  postcode?: string;
  suburb?: string;
  street?: string;
  lon: number;
  lat: number;
  bbox?: [number, number, number, number];
  plus_code?: string;
  plus_code_short?: string;
  rank?: any;
  datasource?: any;
  timezone?: any;
  categories?: string[];
  details?: any[];
  neighbourhood?: string;
  road?: string;
  house_number?: string;
  osm_id?: string;
  osm_type?: string;
  iso3166_2?: string;
  other_names?: any;
}

// Convert GeoApify feature to MapTiler-like format for compatibility
const convertToMapTilerFormat = (feature: GeoApifyFeature): any => {
  if (!feature || !feature.place_id) {
    console.error("Invalid feature passed to convertToMapTilerFormat:", feature);
    return null;
  }

  return {
    id: feature.place_id,
    text: feature.formatted || feature.name || "Unknown location",
    place_name: feature.formatted || feature.name || "Unknown location",
    center: [feature.lon, feature.lat],
    context: [],
    properties: feature,
  };
};

/**
 * Radius in km → approximate bounding box around lat/lng
 */
const buildBBox = (lat: number, lon: number, radiusKm: number): [number, number, number, number] => {
  const deltaLat = radiusKm / 111;               // 1 degree ≈ 111km
  const deltaLon = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const minLat = lat - deltaLat;
  const maxLat = lat + deltaLat;
  const minLon = lon - deltaLon;
  const maxLon = lon + deltaLon;

  return [minLon, minLat, maxLon, maxLat];
};

/**
 * Simple Haversine distance in km
 */
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

/**
 * Search for specific venues or points of interest (POIs) using GeoApify
 */
export const searchVenues = async (
  query: string,
  proximity?: { latitude: number; longitude: number },
  bbox?: [number, number, number, number],
  radiusKm = 15
): Promise<any[]> => {
  if (!query || query.trim().length < 2 || !GEOAPIFY_KEY) return [];

  try {
    let url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_KEY}&limit=10&format=json`;

    if (bbox) {
      url += `&rect=${bbox.join(',')}`;
    } else if (proximity) {
      const box = buildBBox(proximity.latitude, proximity.longitude, radiusKm);
      url += `&rect=${box.join(',')}`;
    }

    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const features: GeoApifyFeature[] = data.results || [];

    // Extra filter: keep only features actually within radiusKm
    if (proximity) {
      const { latitude, longitude } = proximity;
      return features
        .filter((f) => {
          const d = haversineKm(latitude, longitude, f.properties.lat, f.properties.lon);
          return d <= radiusKm * 1.5;
        })
        .map(convertToMapTilerFormat);
    }

    return features.map(convertToMapTilerFormat);
  } catch (error) {
    console.error("GeoApify Venue search failed:", error);
    return [];
  }
};

/**
 * Search specifically for cities, regions, and countries using GeoApify
 */
export const searchLocations = async (
  query: string,
  proximity?: { latitude: number; longitude: number },
  bbox?: [number, number, number, number],
  radiusKm = 20
): Promise<any[]> => {
  if (!query || query.trim().length < 2 || !GEOAPIFY_KEY) return [];

  try {
    let url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_KEY}&limit=6&format=json&type=city`;

    if (bbox) {
      url += `&rect=${bbox.join(',')}`;
    } else if (proximity) {
      const box = buildBBox(proximity.latitude, proximity.longitude, radiusKm);
      url += `&rect=${box.join(',')}`;
    }

    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const features: GeoApifyFeature[] = data.results || [];
    return features.map(convertToMapTilerFormat).filter(result => result !== null);
  } catch (error) {
    console.error("GeoApify Location search failed:", error);
    return [];
  }
};

/**
 * Reverse geocoding to get location from coordinates using GeoApify
 */
export const reverseGeocode = async (lat: number, lon: number): Promise<any | null> => {
  if (!GEOAPIFY_KEY) return null;

  try {
    const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEOAPIFY_KEY}&limit=1&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.results?.[0];
    return feature ? convertToMapTilerFormat(feature) : null;
  } catch (error) {
    console.error("GeoApify Reverse geocode failed:", error);
    return null;
  }
};

/**
 * General search for both venues and locations using GeoApify
 */
export const searchAll = async (
  query: string,
  proximity?: { latitude: number; longitude: number },
  bbox?: [number, number, number, number],
  radiusKm = 15
): Promise<any[]> => {
  console.log("GeoApify searchAll called with:", { query, proximity, bbox, radiusKm });
  console.log("GEOAPIFY_KEY exists:", !!GEOAPIFY_KEY);

  if (!query || query.trim().length < 2 || !GEOAPIFY_KEY) {
    console.log("Search cancelled - query too short or no API key");
    return [];
  }

  try {
    let url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_KEY}&limit=10&format=json`;
    console.log("API URL:", url);

    if (bbox) {
      url += `&rect=${bbox.join(',')}`;
    } else if (proximity) {
      const box = buildBBox(proximity.latitude, proximity.longitude, radiusKm);
      url += `&rect=${box.join(',')}`;
    }

    console.log("Final URL:", url);
    const res = await fetch(url);
    console.log("Response status:", res.status);

    if (!res.ok) {
      console.error("API request failed:", res.status, res.statusText);
      return [];
    }

    const data = await res.json();
    console.log("API response:", data);

    const features: GeoApifyFeature[] = data.results || [];
    console.log("Features found:", features.length);

    // Apply radius filtering if proximity is provided
    if (proximity) {
      const { latitude, longitude } = proximity;
      const filtered = features
        .filter((f) => {
          const d = haversineKm(latitude, longitude, f.lat, f.lon);
          return d <= radiusKm * 1.5;
        })
        .map(convertToMapTilerFormat)
        .filter(result => result !== null);
      console.log("Filtered results:", filtered.length);
      return filtered;
    }

    const results = features
      .filter(feature => feature && typeof feature === 'object' && feature.place_id)
      .map(convertToMapTilerFormat)
      .filter(result => result !== null);
    console.log("Final results:", results.length);
    return results;
  } catch (error) {
    console.error("GeoApify General search failed:", error);
    return [];
  }
};
