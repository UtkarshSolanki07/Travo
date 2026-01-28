const GEOAPIFY_API_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY;

export interface GeoApifyResult {
  place_id?: string;
  id?: string;
  formatted: string;
  lon: number;
  lat: number;
  name?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  result_type?: string;
  categories?: string[];
  [key: string]: any;
}

export interface GeoApifyFeature {
  id: string;
  text: string;
  place_name: string;
  center: [number, number];
  context?: {
    id: string;
    text: string;
  }[];
  properties?: GeoApifyResult;
  place_id?: string;
}

/**
 * Search for places using GeoApify
 */
export const searchAll = async (
  query: string,
  proximity?: { latitude: number; longitude: number },
  bbox?: [number, number, number, number],
  radiusKm = 15,
): Promise<GeoApifyFeature[]> => {
  if (!query || query.trim().length < 2 || !GEOAPIFY_API_KEY) return [];

  try {
    let url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_API_KEY}&limit=10&format=json`;

    if (proximity) {
      url += `&bias=proximity:${proximity.longitude},${proximity.latitude}`;
    }

    if (bbox) {
      url += `&bbox=${bbox.join(",")}`;
    }

    const res = await fetch(url);
    if (!res.ok) return [];
    
    const data = await res.json();
    const results: GeoApifyResult[] = data.results || [];

    return results.map((f) => ({
      id: f.place_id || f.id || `${f.lat}-${f.lon}`,
      text: f.name || f.formatted,
      place_name: f.formatted,
      center: [f.lon, f.lat],
      properties: f,
      place_id: f.place_id || f.id,
    }));
  } catch (error) {
    console.error("GeoApify search failed:", error);
    return [];
  }
};

/**
 * Reverse geocoding to get location from coordinates
 */
export const reverseGeocode = async (
  lat: number,
  lon: number,
): Promise<GeoApifyFeature | null> => {
  if (!GEOAPIFY_API_KEY) return null;

  try {
    const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEOAPIFY_API_KEY}&format=json`;
    const res = await fetch(url);
    
    if (!res.ok) return null;
    
    const data = await res.json();
    const f = data.results?.[0] as GeoApifyResult;
    
    if (!f) return null;

    return {
      id: f.place_id || f.id || `${f.lat}-${f.lon}`,
      text: f.name || f.formatted,
      place_name: f.formatted,
      center: [f.lon, f.lat],
      properties: f,
      place_id: f.place_id || f.id,
    };
  } catch (error) {
    console.error("GeoApify Reverse geocode failed:", error);
    return null;
  }
};