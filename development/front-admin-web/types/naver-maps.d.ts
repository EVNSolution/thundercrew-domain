// Minimal type declarations for NAVER Cloud Platform Maps Web SDK (GL build).
// Only the surface we currently use is typed; expand as we wire polygons and
// info windows.

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
  Point: NaverPointConstructor;
  Size: NaverSizeConstructor;
  Marker: NaverMarkerConstructor;
  Polygon: NaverPolygonConstructor;
  Event: NaverMapEventNamespace;
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

interface NaverPointConstructor {
  new (x: number, y: number): NaverPoint;
}

export interface NaverPoint {
  x: number;
  y: number;
}

interface NaverSizeConstructor {
  new (width: number, height: number): NaverSize;
}

export interface NaverSize {
  width: number;
  height: number;
}

interface NaverMarkerConstructor {
  new (options: NaverMarkerOptions): NaverMarkerInstance;
}

export interface NaverMarkerIcon {
  content?: string;
  anchor?: NaverPoint;
  size?: NaverSize;
}

export interface NaverMarkerOptions {
  position: NaverLatLng;
  map?: NaverMapInstance | null;
  title?: string;
  icon?: NaverMarkerIcon | string;
  zIndex?: number;
  clickable?: boolean;
}

export interface NaverMarkerInstance {
  setMap(map: NaverMapInstance | null): void;
  setPosition?(latLng: NaverLatLng): void;
  setIcon?(icon: NaverMarkerIcon | string): void;
}

export interface NaverEventListener {
  // Opaque handle used with `Event.removeListener`.
  readonly __brand: "naver-event-listener";
}

interface NaverMapEventNamespace {
  addListener(
    target: NaverMapInstance | NaverMarkerInstance | NaverPolygonInstance,
    eventName: string,
    handler: (event: unknown) => void,
  ): NaverEventListener;
  removeListener(listener: NaverEventListener): void;
}

interface NaverPolygonConstructor {
  new (options: NaverPolygonOptions): NaverPolygonInstance;
}

export interface NaverPolygonOptions {
  map?: NaverMapInstance | null;
  paths: NaverLatLng[] | NaverLatLng[][];
  fillColor?: string;
  fillOpacity?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  strokeStyle?: "solid" | "dashed" | "dot";
  zIndex?: number;
  clickable?: boolean;
}

export interface NaverPolygonInstance {
  setMap(map: NaverMapInstance | null): void;
  setPaths?(paths: NaverLatLng[] | NaverLatLng[][]): void;
  setOptions?(options: Partial<NaverPolygonOptions>): void;
}
