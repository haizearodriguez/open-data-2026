export interface ArbolVitoriaProperties {
  CODIGO: string;
  SECTOR: string;
  ESPECIE: string;
  PRESENCIA: 'SI' | 'FALTA';
  PERIM_TRON: string;
  DIAME_COPA: string;
  ALTUR_TOTA: string;
  CALLE_TEMA: string;
}

export interface ArbolVitoriaFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // Recibe [UTM_X, UTM_Y], se convertirá a [Lng, Lat]
  };
  properties: ArbolVitoriaProperties;
}

export interface ArbolVitoriaGeoJSON {
  type: 'FeatureCollection';
  features: ArbolVitoriaFeature[];
}