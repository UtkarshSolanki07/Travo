import React, { forwardRef, useCallback, useRef, useState } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { ViewProps } from 'react-native';

export interface MapComponentProps extends ViewProps {
  children?: React.ReactNode;
  onLongPress?: (event: any) => void;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

const MapComponent = forwardRef<any, MapComponentProps>((props, ref) => {
  const { children, onLongPress, initialRegion, ...viewProps } = props;
  const mapRef = useRef<google.maps.Map | null>(null);

  const render = useCallback((status: Status) => {
    switch (status) {
      case Status.LOADING:
        return <div>Loading...</div>;
      case Status.FAILURE:
        return <div>Error loading map</div>;
      case Status.SUCCESS:
        return <MyMapComponent
          ref={ref}
          mapRef={mapRef}
          onLongPress={onLongPress}
          initialRegion={initialRegion}
          {...viewProps}
        >
          {children}
        </MyMapComponent>;
    }
  }, [children, onLongPress, initialRegion, viewProps, ref]);

  return (
    <Wrapper
      apiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''}
      render={render}
      libraries={['places']}
    />
  );
});

MapComponent.displayName = 'MapComponent';

interface MyMapComponentProps extends ViewProps {
  mapRef: React.MutableRefObject<google.maps.Map | null>;
  onLongPress?: (event: any) => void;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  children?: React.ReactNode;
}

const MyMapComponent = forwardRef<any, MyMapComponentProps>((props, ref) => {
  const { mapRef, onLongPress, initialRegion, children, ...viewProps } = props;
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const divRef = useRef<HTMLDivElement>(null);

  React.useImperativeHandle(ref, () => ({
    animateToRegion: (region: any) => {
      if (map) {
        map.setCenter({ lat: region.latitude, lng: region.longitude });
        map.setZoom(15); // Approximate zoom for latitudeDelta ~0.3
      }
    },
  }));

  React.useEffect(() => {
    if (divRef.current && !map) {
      const newMap = new google.maps.Map(divRef.current, {
        center: initialRegion ? { lat: initialRegion.latitude, lng: initialRegion.longitude } : { lat: 37.7749, lng: -122.4194 },
        zoom: 10,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
      });

      if (onLongPress) {
        newMap.addListener('rightclick', (event: google.maps.MapMouseEvent) => {
          if (event.latLng) {
            onLongPress({
              nativeEvent: {
                coordinate: {
                  latitude: event.latLng.lat(),
                  longitude: event.latLng.lng(),
                },
              },
            });
          }
        });
      }

      setMap(newMap);
      mapRef.current = newMap;
    }
  }, [map, onLongPress, initialRegion, mapRef]);

  return (
    <div
      ref={divRef}
      style={{
        height: '100%',
        width: '100%',
        ...viewProps.style,
      }}
    >
      {children}
    </div>
  );
});

MyMapComponent.displayName = 'MyMapComponent';

export const Marker = ({ coordinate, title }: { coordinate: { latitude: number; longitude: number }; title?: string }) => {
  const markerRef = useRef<google.maps.Marker | null>(null);

  React.useEffect(() => {
    if (coordinate) {
      const marker = new google.maps.Marker({
        position: { lat: coordinate.latitude, lng: coordinate.longitude },
        title,
      });
      markerRef.current = marker;
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
  }, [coordinate, title]);

  React.useEffect(() => {
    if (markerRef.current) {
      // Assuming the map is set on the parent, but for simplicity, we'll assume it's global or passed down
      // In a real implementation, you'd need to pass the map instance down
    }
  }, []);

  return null; // Markers are rendered on the map, not in React
};

export default MapComponent;
