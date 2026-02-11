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
 * Search for venues by NAME (what user types in search)
 * Used when user is adding a "Place" to their post
 */
export const searchVenues = async (
  query: string,
  proximity?: { latitude: number; longitude: number },
  bbox?: [number, number, number, number],
): Promise<GeoApifyFeature[]> => {
  if (!query || query.trim().length < 3 || !GEOAPIFY_API_KEY) return [];

  try {
    // Use autocomplete for TEXT search - RECOMMENDED for search bars
    let url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&type=amenity&limit=10&apiKey=${GEOAPIFY_API_KEY}`;

    if (bbox) {
      // Format: lon1,lat1,lon2,lat2
      url += `&filter=rect:${bbox.join(",")}`;
    } else if (proximity) {
      // Use proximity bias and filter if no explicit bounding box
      url += `&bias=proximity:${proximity.longitude},${proximity.latitude}`;
      url += `&filter=circle:${proximity.longitude},${proximity.latitude},50000`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Geoapify autocomplete error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const features = data.features || [];

    return features.map((f: any) => {
      const props = f.properties || {};

      // Build context
      const context = [];
      if (props.city)
        context.push({ id: `city.${props.city}`, text: props.city });
      if (props.state)
        context.push({ id: `state.${props.state}`, text: props.state });
      if (props.country)
        context.push({ id: `country.${props.country}`, text: props.country });

      return {
        id: props.place_id || f.id || `${props.lat}-${props.lon}`,
        text: props.name || props.formatted?.split(",")[0] || "Unknown Venue",
        place_name: props.formatted,
        center: [props.lon, props.lat],
        context: context.length > 0 ? context : undefined,
        properties: props,
        place_id: props.place_id || f.id,
      };
    });
  } catch (error) {
    console.error("Venue search failed:", error);
    return [];
  }
};

/**
 * Browse venues by CATEGORY in an area (no text search)
 * Used for map exploration and "discovery" modes
 */
export const browseVenuesByCategory = async (
  category: string, // e.g., "catering.cafe"
  bbox: [number, number, number, number], // [lon1, lat1, lon2, lat2]
): Promise<GeoApifyFeature[]> => {
  if (!GEOAPIFY_API_KEY) return [];

  try {
    // Use /v2/places for category browsing - NO text parameter
    const url = `https://api.geoapify.com/v2/places?categories=${category}&filter=rect:${bbox.join(",")}&limit=20&apiKey=${GEOAPIFY_API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Geoapify places v2 error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const features = data.features || [];

    return features.map((f: any) => {
      const props = f.properties || {};
      return {
        id: props.place_id || f.id,
        text: props.name || props.address_line1 || "Unnamed Venue",
        place_name: props.formatted || props.address_line1,
        center: [props.lon, props.lat],
        properties: props,
        place_id: props.place_id || f.id,
      };
    });
  } catch (error) {
    console.error("Browse venues failed:", error);
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
    let url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_API_KEY}&limit=10`;

    if (proximity) {
      url += `&bias=proximity:${proximity.longitude},${proximity.latitude}`;
    }

    // Prefer cities, counties, and countries
    url += `&type=city,county,country,locality`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Geoapify locations error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const features = data.features || [];

    return features.map((f: any) => {
      const props = f.properties || {};

      const context = [];
      if (props.city)
        context.push({ id: `city.${props.city}`, text: props.city });
      if (props.state)
        context.push({ id: `state.${props.state}`, text: props.state });
      if (props.country)
        context.push({ id: `country.${props.country}`, text: props.country });

      const bestName =
        props.name ||
        props.city ||
        props.state ||
        props.country ||
        props.formatted ||
        "Unknown Location";

      return {
        id: props.place_id || f.id || `${props.lat}-${props.lon}`,
        text: bestName,
        place_name: props.formatted || bestName,
        center: [props.lon, props.lat],
        context: context.length > 0 ? context : undefined,
        properties: props,
        place_id: props.place_id || f.id,
      };
    });
  } catch (error) {
    console.error("Location search failed:", error);
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
): Promise<GeoApifyFeature[]> => {
  if (!query || query.trim().length < 2 || !GEOAPIFY_API_KEY) return [];

  try {
    let url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_API_KEY}&limit=10`;

    if (proximity) {
      url += `&bias=proximity:${proximity.longitude},${proximity.latitude}`;
    }

    if (bbox) {
      url += `&filter=rect:${bbox.join(",")}`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Geoapify searchAll error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const features = data.features || [];

    return features.map((f: any) => {
      const props = f.properties || {};

      return {
        id: props.place_id || f.id || `${props.lat}-${props.lon}`,
        text: props.name || props.formatted,
        place_name: props.formatted,
        center: [props.lon, props.lat],
        properties: props,
        place_id: props.place_id || f.id,
      };
    });
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
    const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEOAPIFY_API_KEY}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`Geoapify reverse geocode error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const f = data.features?.[0];

    if (!f) return null;

    const props = f.properties || {};

    return {
      id: props.place_id || f.id || `${props.lat}-${props.lon}`,
      text: props.name || props.formatted,
      place_name: props.formatted,
      center: [props.lon, props.lat],
      properties: props,
      place_id: props.place_id || f.id,
    };
  } catch (error) {
    console.error("GeoApify Reverse geocode failed:", error);
    return null;
  }
};
