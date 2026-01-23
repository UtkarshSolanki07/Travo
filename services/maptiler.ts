const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY;

export interface MapTilerFeature {
  id: string;
  text: string;
  place_name: string;
  center: [number, number];
  context?: {
    id: string;
    text: string;
  }[];
  properties?: any;
}

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
 * Search for specific venues or points of interest (POIs) using MapTiler
 */
export const searchVenues = async (
  query: string, 
  proximity?: { latitude: number; longitude: number },
  bbox?: [number, number, number, number],
  radiusKm = 15
): Promise<MapTilerFeature[]> => {
  if (!query || query.trim().length < 2 || !MAPTILER_KEY) return [];

  try {
    let url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&types=poi&limit=10&language=en`;
    
    if (bbox) {
      url += `&bbox=${bbox.join(',')}&bounded=1`;
    } else if (proximity) {
      // Build bbox on the fly from proximity to force locality
      const box = buildBBox(proximity.latitude, proximity.longitude, radiusKm);
      url += `&bbox=${box.join(',')}&bounded=1` + 
             `&proximity=${proximity.longitude},${proximity.latitude}`;
    }

    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const features: MapTilerFeature[] = data.features || [];

    // Extra filter: keep only features actually within radiusKm
    if (proximity) {
      const { latitude, longitude } = proximity;
      return features.filter((f) => {
        const [lon, lat] = f.center;
        const d = haversineKm(latitude, longitude, lat, lon);
        return d <= radiusKm * 1.5; // Allow small overshoot for better UX
      });
    }

    return features;
  } catch (error) {
    console.error("MapTiler Venue search failed:", error);
    return [];
  }
};

/**
 * Search specifically for cities, regions, and countries using MapTiler
 */
export const searchLocations = async (
  query: string,
  proximity?: { latitude: number; longitude: number },
  bbox?: [number, number, number, number],
  radiusKm = 20
): Promise<MapTilerFeature[]> => {
  if (!query || query.trim().length < 2 || !MAPTILER_KEY) return [];

  try {
    let url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&types=city,town,place&limit=6&language=en`;
    
    if (bbox) {
      url += `&bbox=${bbox.join(',')}&bounded=1`;
    } else if (proximity) {
      const box = buildBBox(proximity.latitude, proximity.longitude, radiusKm);
      url += `&bbox=${box.join(',')}&bounded=1` + 
             `&proximity=${proximity.longitude},${proximity.latitude}`;
    }

    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return data.features || [];
  } catch (error) {
    console.error("MapTiler Location search failed:", error);
    return [];
  }
};

/**
 * Reverse geocoding to get location from coordinates
 */
export const reverseGeocode = async (lat: number, lon: number): Promise<MapTilerFeature | null> => {
  if (!MAPTILER_KEY) return null;

  try {
    const url = `https://api.maptiler.com/geocoding/${lon},${lat}.json?key=${MAPTILER_KEY}&limit=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.features?.[0] || null;
  } catch (error) {
    console.error("MapTiler Reverse geocode failed:", error);
    return null;
  }
};

/**
 * General search for both venues and locations using MapTiler
 */
export const searchAll = async (
  query: string,
  proximity?: { latitude: number; longitude: number },
  bbox?: [number, number, number, number],
  radiusKm = 15
): Promise<MapTilerFeature[]> => {
  if (!query || query.trim().length < 2 || !MAPTILER_KEY) return [];

  try {
    let url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&limit=10&language=en`;
    
    if (bbox) {
      url += `&bbox=${bbox.join(',')}&bounded=1`;
    } else if (proximity) {
      const box = buildBBox(proximity.latitude, proximity.longitude, radiusKm);
      url += `&bbox=${box.join(',')}&bounded=1` + 
             `&proximity=${proximity.longitude},${proximity.latitude}`;
    }

    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const features: MapTilerFeature[] = data.features || [];

    // Apply radius filtering if proximity is provided
    if (proximity) {
      const { latitude, longitude } = proximity;
      return features.filter((f) => {
        const [lon, lat] = f.center;
        const d = haversineKm(latitude, longitude, lat, lon);
        return d <= radiusKm * 1.5;
      });
    }

    return features;
  } catch (error) {
    console.error("MapTiler General search failed:", error);
    return [];
  }
};
