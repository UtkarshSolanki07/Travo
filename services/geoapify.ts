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
 * Search for venues (specific places like cafes, restaurants, landmarks)
 * Used when user is adding a "Place" to their post
 */
export const searchVenues = async (
  query: string,
  proximity?: { latitude: number; longitude: number },
): Promise<GeoApifyFeature[]> => {
  if (!query || query.trim().length < 3 || !GEOAPIFY_API_KEY) return [];

  try {
    // Use Places API for venue search with specific categories
    const categories = [
      'catering.restaurant',
      'catering.cafe',
      'catering.bar',
      'tourism.attraction',
      'tourism.sights',
      'sport.stadium',
      'entertainment',
      'commercial.shopping_mall',
      'leisure',
      'accommodation.hotel',
      'building',
    ].join(',');

    let url = `https://api.geoapify.com/v2/places?categories=${categories}&text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_API_KEY}&limit=10`;

    if (proximity) {
      // Add filter for proximity search (within 50km radius)
      url += `&filter=circle:${proximity.longitude},${proximity.latitude},50000`;
      url += `&bias=proximity:${proximity.longitude},${proximity.latitude}`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Geoapify venues error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const features = data.features || [];

    return features.map((f: any) => {
      const props = f.properties;
      
      // Build context from address components
      const context = [];
      if (props.city) {
        context.push({ id: `city.${props.city}`, text: props.city });
      }
      if (props.state) {
        context.push({ id: `state.${props.state}`, text: props.state });
      }
      if (props.country) {
        context.push({ id: `country.${props.country}`, text: props.country });
      }

      return {
        id: props.place_id || f.id || `${props.lat}-${props.lon}`,
        text: props.name || props.formatted,
        place_name: props.formatted || `${props.name || 'Unnamed'}, ${props.city || props.country || ''}`,
        center: [props.lon, props.lat],
        context: context.length > 0 ? context : undefined,
        properties: props,
        place_id: props.place_id || f.id,
      };
    });
  } catch (error) {
    console.error('Venue search failed:', error);
    return [];
  }
};

/**
 * Search for general locations (cities, countries, neighborhoods, addresses)
 * Used when user is adding a "Location" to their post
 */
export const searchLocations = async (
  query: string,
  proximity?: { latitude: number; longitude: number },
): Promise<GeoApifyFeature[]> => {
  if (!query || query.trim().length < 2 || !GEOAPIFY_API_KEY) return [];

  try {
    // Use Geocoding API for general location search
    let url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_API_KEY}&limit=10&format=json`;

    if (proximity) {
      url += `&bias=proximity:${proximity.longitude},${proximity.latitude}`;
    }

    // Prefer cities, states, and countries over specific addresses
    url += `&type=city,state,country,locality`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Geoapify locations error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const results: GeoApifyResult[] = data.results || [];

    return results.map((f) => {
      // Build context from address components
      const context = [];
      if (f.city) {
        context.push({ id: `city.${f.city}`, text: f.city });
      }
      if (f.state) {
        context.push({ id: `state.${f.state}`, text: f.state });
      }
      if (f.country) {
        context.push({ id: `country.${f.country}`, text: f.country });
      }

      return {
        id: f.place_id || f.id || `${f.lat}-${f.lon}`,
        text: f.name || f.city || f.formatted,
        place_name: f.formatted,
        center: [f.lon, f.lat],
        context: context.length > 0 ? context : undefined,
        properties: f,
        place_id: f.place_id || f.id,
      };
    });
  } catch (error) {
    console.error('Location search failed:', error);
    return [];
  }
};

/**
 * General search for all places (fallback or combined search)
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