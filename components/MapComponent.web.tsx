import React, {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useImperativeHandle,
} from "react";
import { View, ViewProps } from "react-native";

export interface MapComponentProps extends ViewProps {
  children?: React.ReactNode;
  onLongPress?: (event: any) => void;
}

type MapContextValue = {
  map: google.maps.Map | null;
};

const MapContext = createContext<MapContextValue>({ map: null });

let googleMapsPromise: Promise<void> | null = null;

const loadGoogleMaps = (apiKey: string) => {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector("script[data-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-google-maps", "true");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
};

const MapComponent = forwardRef<any, MapComponentProps>((props, ref) => {
  const { style, children, onLongPress, ...rest } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const rightClickListenerRef = useRef<google.maps.MapsEventListener | null>(
    null,
  );
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // expose a minimal API compatible with react-native-maps MapView used on native
  useImperativeHandle(ref, () => ({
    animateToRegion: (
      region: { latitude: number; longitude: number; latitudeDelta?: number; longitudeDelta?: number },
      /* duration in ms - ignored for web, present for compatibility */ _duration?: number,
    ) => {
      const created = mapRef.current;
      if (!created) return;

      const { latitude, longitude, longitudeDelta } = region as any;
      created.panTo({ lat: latitude, lng: longitude });

      // approximate a zoom level from longitudeDelta (simple heuristic)
      if (typeof longitudeDelta === "number" && longitudeDelta > 0) {
        const zoom = Math.round(Math.log2(360 / longitudeDelta));
        try {
          created.setZoom(zoom);
        } catch (err) {
          console.warn("Failed to set zoom level on map:", err);
        }
      }
    },
  }), []);

  useEffect(() => {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn(
        "Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY for Google Maps web.",
      );
      return;
    }

    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;

        const created = new google.maps.Map(containerRef.current, {
          center: { lat: 37.7749, lng: -122.4194 },
          zoom: 12,
          disableDefaultUI: true,
          gestureHandling: "greedy",
        });

        // store refs so we can cleanup listeners and instance later
        mapRef.current = created;

        if (onLongPress) {
          rightClickListenerRef.current = created.addListener(
            "rightclick",
            (event: google.maps.MapMouseEvent) => {
              if (!event.latLng) return;
              onLongPress({
                nativeEvent: {
                  coordinate: {
                    latitude: event.latLng.lat(),
                    longitude: event.latLng.lng(),
                  },
                },
              });
            },
          );
        }

        setMap(created);
      })
      .catch((error) => {
        console.error("Google Maps failed to load", error);
      });

    return () => {
      cancelled = true;

      // remove event listener if present
      if (rightClickListenerRef.current) {
        const listener = rightClickListenerRef.current as any;
        if (typeof listener.remove === "function") {
          listener.remove();
        } else if (
          window.google?.maps &&
          typeof window.google.maps.event.removeListener === "function"
        ) {
          window.google.maps.event.removeListener(listener);
        }
        rightClickListenerRef.current = null;
      }

      // clear map listeners and reference
      if (
        mapRef.current &&
        window.google?.maps &&
        typeof window.google.maps.event.clearInstanceListeners === "function"
      ) {
        window.google.maps.event.clearInstanceListeners(mapRef.current);
      }
      mapRef.current = null;
      setMap(null);
    };
  }, [onLongPress]);

  const contextValue = useMemo(() => ({ map }), [map]);

  return (
    <View
      ref={ref}
      {...rest}
      className="flex-1 min-h-[200px]"
      style={style}
    >
      <View
        ref={(node) => {
          containerRef.current = node as unknown as HTMLDivElement;
        }}
        className="flex-1"
      />
      <MapContext.Provider value={contextValue}>{children}</MapContext.Provider>
    </View>
  );
});

MapComponent.displayName = "MapComponent";

export const UrlTile = (_props: any) => null;

type MarkerProps = {
  coordinate: { latitude: number; longitude: number };
  title?: string;
};

export const Marker = (props: MarkerProps) => {
  const { map } = useContext(MapContext);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        map,
        position: {
          lat: props.coordinate.latitude,
          lng: props.coordinate.longitude,
        },
        title: props.title,
      });
    } else {
      // update existing marker
      markerRef.current.setPosition({
        lat: props.coordinate.latitude,
        lng: props.coordinate.longitude,
      });
      if (props.title !== undefined) {
        markerRef.current.setTitle(props.title);
      }
      markerRef.current.setMap(map);
    }

    return () => {
      markerRef.current?.setMap(null);
      markerRef.current = null;
    };
  }, [map, props.coordinate.latitude, props.coordinate.longitude, props.title]);

  return null;
};

export default MapComponent;
