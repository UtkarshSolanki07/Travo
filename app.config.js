// Dynamic app config to support environment variables and platform-specific config
// This file overrides app.json when present.

module.exports = ({ config }) => {
  const ANDROID_GOOGLE_MAPS_API_KEY =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''
  const IOS_GOOGLE_MAPS_API_KEY =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || ''

  // Expo Video plugin options
  const VIDEO_BG = process.env.EXPO_PUBLIC_VIDEO_BG ?? process.env.VIDEO_BG
  const VIDEO_PIP = process.env.EXPO_PUBLIC_VIDEO_PIP ?? process.env.VIDEO_PIP
  const supportsBackgroundPlayback = (VIDEO_BG ?? 'true') === 'true'
  const supportsPictureInPicture = (VIDEO_PIP ?? 'true') === 'true'

  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      'expo-audio',
      [
        'expo-video',
        {
          supportsBackgroundPlayback,
          supportsPictureInPicture,
        },
      ],
    ],
    android: {
      ...config.android,
      config: {
        ...(config.android?.config || {}),
        googleMaps: {
          apiKey: ANDROID_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    ios: {
      ...config.ios,
      config: {
        ...(config.ios?.config || {}),
        googleMapsApiKey: IOS_GOOGLE_MAPS_API_KEY,
      },
    },
  }
}
