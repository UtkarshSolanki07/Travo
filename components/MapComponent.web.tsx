import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, ViewProps } from 'react-native';


export interface MapComponentProps extends ViewProps {
  children?: React.ReactNode;
  onLongPress?: (event: any) => void;
}

const MapComponent = forwardRef<View, MapComponentProps>((props, ref) => {
  return (
    <View ref={ref} style={[props.style, styles.webPlaceholder]}>
      <Text style={styles.text}>Map is not supported on web yet.</Text>
      {props.children}
    </View>
  );
});

MapComponent.displayName = 'MapComponent';

export const UrlTile = (props: any) => null;
export const Marker = (props: any) => null;

const styles = StyleSheet.create({
  webPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#666',
  },
});

export default MapComponent;
