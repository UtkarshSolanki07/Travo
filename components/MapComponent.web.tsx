import React, { forwardRef } from 'react';
import { View, Text, ViewProps } from 'react-native';

export interface MapComponentProps extends ViewProps {
  children?: React.ReactNode;
  onLongPress?: (event: any) => void;
}

const MapComponent = forwardRef<View, MapComponentProps>((props, ref) => {
  return (
    <View ref={ref} className="bg-slate-100 justify-center items-center">
      <Text className="text-slate-500">Map is not supported on web yet.</Text>
      {props.children}
    </View>
  );
});

MapComponent.displayName = 'MapComponent';

export const UrlTile = (props: any) => null;
export const Marker = (props: any) => null;

export default MapComponent;
