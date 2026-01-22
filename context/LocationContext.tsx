import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Location {
  latitude: number;
  longitude: number;
}

interface LocationContextType {
  userLocation: Location | null;
  updateLocation: (lat: number, lon: number) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

/**
 * Provides a LocationContext to descendant components and manages the current user location.
 *
 * @param children - React nodes that will receive the location context
 * @returns A React element that supplies `userLocation` and `updateLocation` to its children
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [userLocation, setUserLocation] = useState<Location | null>(null);

  const updateLocation = (latitude: number, longitude: number) => {
    setUserLocation({ latitude, longitude });
  };

  return (
    <LocationContext.Provider value={{ userLocation, updateLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

/**
 * Provides access to the current location context value.
 *
 * @returns The LocationContext value containing `userLocation` and `updateLocation`.
 * @throws Error if the hook is used outside of a LocationProvider.
 */
export function useLocationContext() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
}