export interface ElementoMobiliario {
  id?: string;
  tipo: 'arbol' | 'banco' | 'farola' | 'papelera';
  barrio: string;
  coordenadas: {
    lng: number;
    lat: number;
  };
  fechaCreacion: Date;
}