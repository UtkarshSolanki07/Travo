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

export function useMapContext() {
  const context = useContext(MapContext);
  if (context === undefined) {
    throw new Error("useMapContext must be used within a MapProvider");
  }
  return context;
}
