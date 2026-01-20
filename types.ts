export interface MapData {
  name: string;
  value: number;
  growth: number;
}

export interface GeoJSONFeature {
  type: string;
  properties: {
    name: string;
    cp?: [number, number]; // Center point
    center?: [number, number];
    adcode?: number;
    [key: string]: any;
  };
  geometry: any;
}

export interface GeoJSON {
  type: string;
  features: GeoJSONFeature[];
}