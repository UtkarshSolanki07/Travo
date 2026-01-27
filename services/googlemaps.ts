const GEOAPIFY_API_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_KEY;

export interface GeoApifyFeature {
  id: string;
  text: string;
  place_name: string;
  center: [number, number];
  types?: string[];
  context?: {
    city?: string;
    country?: string;
  };
  properties?: any;
}

/**
 * Search for venues/places using GeoApify Places API
 */
export const searchVenues = async (
  query: string,
  proximity?: { latitude: number; longitude: number },
  radius = 15000
): Promise<GeoApifyFeature[]> => {
  if (!query || query.trim().length < 2 || !GEOAPIFY_API_KEY) return [];

  try {
    let url = `https://api.geoapify.com/v2/places?text=${encodeURIComponent(query)}&categories=commercial&limit=10&apiKey=${GEOAPIFY_API_KEY}`;

    if (proximity) {
      url += `&bias=proximity:${proximity.longitude},${proximity.latitude}`;
    }

    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();

    return (data.features || []).map((place: any) => ({
      id: place.properties.place_id || place.properties.osm_id,
      text: place.properties.name || place.properties.address_line1,
      place_name: place.properties.formatted || place.properties.address_line1,
      center: [place.properties.lon, place.properties.lat],
      types: place.properties.categories,
      context: {
        city: place.properties.city,
        country: place.properties.country
      },
      properties: place.properties
    }));
  } catch (error) {
    console.error("GeoApify Venue search failed:", error);
    return [];
  }
};

/**
 * Search for locations (cities, regions) using GeoApify Geocoding API
 */
export const searchLocations = async (
  query: string,
  proximity?: { latitude: number; longitude: number },
  radius = 20000
): Promise<GeoApifyFeature[]> => {
  if (!query || query.trim().length < 2 || !GEOAPIFY_API_KEY) return [];

  try {
    let url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&type=city&limit=6&apiKey=${GEOAPIFY_API_KEY}`;

    if (proximity) {
      url += `&bias=proximity:${proximity.longitude},${proximity.latitude}`;
    }

    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();

    return (data.features || []).map((result: any) => ({
      id: result.properties.place_id || result.properties.osm_id,
      text: result.properties.formatted || result.properties.address_line1,
      place_name: result.properties.formatted || result.properties.address_line1,
      center: [result.properties.lon, result.properties.lat],
      types: result.properties.categories,
      context: {
        city: result.properties.city,
        country: result.properties.country
      },
      properties: result.properties
    }));
  } catch (error) {
    console.error("GeoApify Location search failed:", error);
    return [];
  }
};

/**
 * Reverse geocoding using GeoApify Reverse Geocoding API
 */
export const reverseGeocode = async (lat: number, lon: number): Promise<GeoApifyFeature | null> => {
  if (!GEOAPIFY_API_KEY) return null;

  try {
    const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEOAPIFY_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    if (!data.features?.[0]) return null;

    const result = data.features[0];
    return {
      id: result.properties.place_id || result.properties.osm_id,
      text: result.properties.formatted || result.properties.address_line1,
      place_name: result.properties.formatted || result.properties.address_line1,
      center: [result.properties.lon, result.properties.lat],
      types: result.properties.categories,
      context: {
        city: result.properties.city,
        country: result.properties.country
      },
      properties: result.properties
    };
  } catch (error) {
    console.error("GeoApify Reverse geocode failed:", error);
    return null;
  }
};

/**
 * General search combining venues and locations
 */
export const searchAll = async (
  query: string,
  proximity?: { latitude: number; longitude: number },
  radius = 15000
): Promise<GeoApifyFeature[]> => {
  const [venues, locations] = await Promise.all([
    searchVenues(query, proximity, radius),
    searchLocations(query, proximity, radius)
  ]);

  // Combine and deduplicate results
  const all = [...venues, ...locations];
  const seen = new Set<string>();
  return all.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};