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

export function useLocationContext() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
}
