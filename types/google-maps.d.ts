/// <reference types="google.maps" />

// Ensure global Window can optionally include google to avoid editor warnings
declare global {
  interface Window {
    google?: typeof google;
  }
}

export { };

