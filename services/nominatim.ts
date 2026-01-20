export const searchPlaces = async (query: string) => {
  if (!query || query.trim().length === 0) return [];

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&addressdetails=1&limit=6`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "travo-app-dev"
      }
    });

    if (!res.ok) {
      console.warn("Nominatim API returned non-OK status:", res.status);
      return [];
    }

    return await res.json();
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
};

export const reverseGeocode = async (lat: number, lon: number) => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "travo-app-dev"
      }
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Reverse geocode failed:", error);
    return null;
  }
};
