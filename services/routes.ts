export type LatLng = { latitude: number; longitude: number };

const GEOAPIFY_API_KEY = process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY;

/**
 * Fetches a driving route between two coordinates from the Geoapify Routing API.
 *
 * @param origin - Starting coordinate with `latitude` and `longitude`
 * @param destination - Ending coordinate with `latitude` and `longitude`
 * @returns An object with `points` (array of `LatLng` in latitude/longitude order), `distanceKm` (route length in kilometers), and `durationMin` (estimated travel time in minutes), or `null` if the route could not be obtained
 */
export async function getRoute(
  origin: LatLng,
  destination: LatLng,
): Promise<{
  points: LatLng[];
  distanceKm: number;
  durationMin: number;
} | null> {
  if (!GEOAPIFY_API_KEY) {
    console.error("Geoapify API key is missing");
    return null;
  }

  try {
    const originStr = `${origin.latitude},${origin.longitude}`;
    const destStr = `${destination.latitude},${destination.longitude}`;

    // Geoapify Routing API with traffic approximation
    const url = `https://api.geoapify.com/v1/routing?waypoints=${originStr}|${destStr}&mode=drive&traffic=approximated&apiKey=${GEOAPIFY_API_KEY}`;

    const res = await fetch(url);

    if (!res.ok) {
      console.error("Failed to fetch route from Geoapify", res.status);
      return null;
    }

    const data = await res.json();
    const feature = data.features?.[0];

    if (!feature) {
      return null;
    }

    const properties = feature.properties;

    // Geoapify returns distance in meters and time in seconds
    const distanceKm = properties.distance / 1000;
    const durationMin = properties.time / 60;

    // Geoapify returns coordinates as [lon, lat] arrays in geometry.coordinates
    // For "drive" mode it might be a MultiLineString or LineString.
    // Usually features[0].geometry.coordinates is an array of arrays of positions for LineString
    // or array of array of arrays for MultiLineString.

    const geometry = feature.geometry;
    let rawPoints: number[][] = [];

    if (geometry.type === "LineString") {
      rawPoints = geometry.coordinates;
    } else if (geometry.type === "MultiLineString") {
      // Flatten MultiLineString
      geometry.coordinates.forEach((segment: number[][]) => {
        rawPoints.push(...segment);
      });
    }

    const points: LatLng[] = rawPoints.map((p) => ({
      latitude: p[1], // GeoJSON is [lon, lat]
      longitude: p[0],
    }));

    return { points, distanceKm, durationMin };
  } catch (error) {
    console.error("getRoute error:", error);
    return null;
  }
}