import { createContext, ReactNode, useContext, useState } from "react";

export interface Location {
  latitude: number;
  longitude: number;
}

export interface SelectedLocation extends Location {
  name?: string;
  formattedAddress?: string;
}

interface MapContextType {
  userLocation: Location | null;
  selectedLocation: SelectedLocation | null;
  radiusKm: number;
  setUserLocation: (location: Location | null) => void;
  setSelectedLocation: (location: SelectedLocation | null) => void;
  setRadiusKm: (radius: number) => void;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

/**
 * Provides map-related state (user location, selected location, and search radius) to descendant components.
 *
 * @param children - React nodes to render inside the provider
 * @returns A provider element that supplies `userLocation`, `selectedLocation`, `radiusKm` (defaults to 5), and their corresponding setter functions to its descendants
 */
export function MapProvider({ children }: { children: ReactNode }) {
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [selectedLocation, setSelectedLocation] =
    useState<SelectedLocation | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5); // Default 5km radius

  return (
    <MapContext.Provider
      value={{
        userLocation,
        selectedLocation,
        radiusKm,
        setUserLocation,
        setSelectedLocation,
        setRadiusKm,
      }}
    >
      {children}
    </MapContext.Provider>
  );
}

/**
 * Retrieves the current map context value for use within React components.
 *
 * @returns The map context object containing `userLocation`, `selectedLocation`, `radiusKm`, and their setter functions.
 * @throws Error if called outside of a `MapProvider`
 */
export function useMapContext() {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error("useMapContext must be used within a MapProvider");
  }
  return context;
}