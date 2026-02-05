import React, { forwardRef } from 'react';
import MapView, { UrlTile, Marker, MapViewProps } from 'react-native-maps';


export interface MapComponentProps extends MapViewProps {
  children?: React.ReactNode;
}

const MapComponent = forwardRef<MapView, MapComponentProps>((props, ref) => {
  const { style, children, ...rest } = props;
  return (
    <MapView
      ref={ref}
      {...rest}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </MapView>
  );
});

MapComponent.displayName = 'MapComponent';

export { UrlTile, Marker };
export default MapComponent;
