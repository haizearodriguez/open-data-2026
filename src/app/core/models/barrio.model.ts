export interface BarrioData {
  displayFieldName: string;
  fieldAliases: FieldAliases;
  geometryType: string;
  spatialReference: SpatialReference;
  fields: Field[];
  features: Feature[];
}

interface Feature {
  attributes: Attributes;
  geometry: Geometry;
}

interface Geometry {
  rings: number[][][];
}

interface Attributes {
  OBJECTID: number;
  BARRIO: number;
  TEXTO: string;
  SHAPE__ST_AREA__: number;
  SHAPE__SDELENGTH__: number;
  'DB2GSE.ST_Area(SHAPE)': number;
  'DB2GSE.SdeLength(SHAPE)': number;
}

interface Field {
  name: string;
  type: string;
  alias: string;
  length?: number;
}

interface SpatialReference {
  wkid: number;
  latestWkid: number;
}

interface FieldAliases {
  OBJECTID: string;
  BARRIO: string;
  TEXTO: string;
  SHAPE__ST_AREA__: string;
  SHAPE__SDELENGTH__: string;
  'DB2GSE.ST_Area(SHAPE)': string;
  'DB2GSE.SdeLength(SHAPE)': string;
}