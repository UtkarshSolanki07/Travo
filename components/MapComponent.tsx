import React, { forwardRef } from 'react';
import MapView, { Marker, MapViewProps } from 'react-native-maps';

export interface MapComponentProps extends MapViewProps {
  children?: React.ReactNode;
}

const MapComponent = forwardRef<MapView, MapComponentProps>((props, ref) => {
  return (
    <MapView ref={ref} {...props}>
      {props.children}
    </MapView>
  );
});

MapComponent.displayName = 'MapComponent';

export { Marker };
export default MapComponent;
