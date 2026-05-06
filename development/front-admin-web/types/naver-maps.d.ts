// Minimal type declarations for NAVER Cloud Platform Maps Web SDK (GL build).
// Only the surface used by `<MapShell>` is typed; expand as we wire markers,
// polygons, and event handlers.

export {};

declare global {
  interface Window {
    naver?: NaverGlobal;
  }
}

interface NaverGlobal {
  maps: NaverMapsNamespace;
}

interface NaverMapsNamespace {
  Map: NaverMapConstructor;
  LatLng: NaverLatLngConstructor;
}

interface NaverMapConstructor {
  new (element: HTMLElement | string, options: NaverMapOptions): NaverMapInstance;
}

interface NaverLatLngConstructor {
  new (lat: number, lng: number): NaverLatLng;
}

export interface NaverLatLng {
  lat(): number;
  lng(): number;
}

export interface NaverMapOptions {
  center: NaverLatLng;
  zoom: number;
  /** Enables WebGL renderer required for `customStyleId`. */
  gl?: boolean;
  /** UUID published from NCP Maps Style Editor. */
  customStyleId?: string;
  minZoom?: number;
  maxZoom?: number;
  draggable?: boolean;
  pinchZoom?: boolean;
  scrollWheel?: boolean;
}

export interface NaverMapInstance {
  destroy?(): void;
  setOptions?(options: Partial<NaverMapOptions>): void;
  setCenter?(latLng: NaverLatLng): void;
  setZoom?(zoom: number): void;
}
