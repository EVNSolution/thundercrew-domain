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
  LatLngBounds: NaverLatLngBoundsConstructor;
  Point: NaverPointConstructor;
  PointBounds: NaverPointBoundsConstructor;
  Size: NaverSizeConstructor;
  Marker: NaverMarkerConstructor;
  Polygon: NaverPolygonConstructor;
  Polyline: NaverPolylineConstructor;
  Event: NaverMapEventNamespace;
  /**
   * Anchor positions used by control options (e.g. `logoControlOptions.position`).
   * NCP exposes these as numeric enum values on `naver.maps.Position`.
   */
  Position: NaverMapsPositionEnum;
}

interface NaverLatLngBoundsConstructor {
  new (sw: NaverLatLng, ne: NaverLatLng): NaverLatLngBounds;
}

export interface NaverLatLngBounds {
  extend(latLng: NaverLatLng): NaverLatLngBounds;
  hasLatLng(latLng: NaverLatLng): boolean;
  isEmpty(): boolean;
}

interface NaverPointBoundsConstructor {
  new (min: NaverPoint, max: NaverPoint): NaverPointBounds;
}

export interface NaverPointBounds {
  extend(point: NaverPoint): NaverPointBounds;
}

interface NaverMapsPositionEnum {
  readonly TOP_LEFT: number;
  readonly TOP_CENTER: number;
  readonly TOP_RIGHT: number;
  readonly LEFT_CENTER: number;
  readonly CENTER: number;
  readonly RIGHT_CENTER: number;
  readonly BOTTOM_LEFT: number;
  readonly BOTTOM_CENTER: number;
  readonly BOTTOM_RIGHT: number;
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
  /** Render the NAVER logo mark. Required by NCP TOS — keep `true`. */
  logoControl?: boolean;
  /** Anchor for the NAVER logo mark. Accepts a `naver.maps.Position` value. */
  logoControlOptions?: NaverLogoControlOptions;
}

export interface NaverLogoControlOptions {
  position?: number;
}

export interface NaverMapInstance {
  destroy?(): void;
  setOptions?(options: Partial<NaverMapOptions>): void;
  setCenter?(latLng: NaverLatLng): void;
  setZoom?(zoom: number): void;
  /**
   * Adjust center + zoom so the given bounds fit the current viewport.
   * The optional `margins` argument lets us reserve padding around the
   * fitted region so the dots don't sit flush against the edges.
   */
  fitBounds?(
    bounds: NaverLatLngBounds,
    margins?: { top?: number; right?: number; bottom?: number; left?: number } | number
  ): void;
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
    target: NaverMapInstance | NaverMarkerInstance | NaverPolygonInstance | NaverPolylineInstance,
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

interface NaverPolylineConstructor {
  new (options: NaverPolylineOptions): NaverPolylineInstance;
}

export interface NaverPolylineOptions {
  map?: NaverMapInstance | null;
  path: NaverLatLng[];
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
  strokeStyle?: "solid" | "shortdash" | "dash";
  zIndex?: number;
  clickable?: boolean;
}

export interface NaverPolylineInstance {
  setMap(map: NaverMapInstance | null): void;
  setPath?(path: NaverLatLng[]): void;
}
