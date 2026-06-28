export type TipoElemento =
  | 'desperfecto'
  | 'fuente'
  | 'zona-verde'
  | 'mobiliario'
  | 'alumbrado'
  | 'accesibilidad'
  | 'otros-via'
  | 'limpieza'
  | 'reciclaje'
  | 'otros-medioambiente';

export interface CategoriaElemento {
  tipo: TipoElemento;
  etiqueta: string;
  emoji: string;
  url: string;
  grupo: 'espacio-publico' | 'medioambiente';
}

export const CATEGORIAS_ELEMENTOS: CategoriaElemento[] = [
  // Espacio público
  { tipo: 'desperfecto',      etiqueta: 'Desperfectos en vía pública', emoji: '🚧', url: 'https://www.vitoria-gasteiz.org/wb021/was/areaAction.do?idioma=es&accion=areas&claveArea=12', grupo: 'espacio-publico' },
  { tipo: 'fuente',        etiqueta: 'Fuentes de agua potable', emoji: '⛲', url: 'https://www.vitoria-gasteiz.org/wb021/was/areaAction.do?idioma=es&accion=areas&claveArea=17', grupo: 'espacio-publico' },
  { tipo: 'zona-verde',       etiqueta: 'Zonas verdes',                emoji: '🌳', url: 'https://www.vitoria-gasteiz.org/wb021/was/areaAction.do?idioma=es&accion=areas&claveArea=16', grupo: 'espacio-publico' },
  { tipo: 'mobiliario',       etiqueta: 'Mobiliario urbano',           emoji: '🪑', url: 'https://www.vitoria-gasteiz.org/wb021/was/areaAction.do?idioma=es&accion=areas&claveArea=17', grupo: 'espacio-publico' },
  { tipo: 'alumbrado',        etiqueta: 'Alumbrado público',           emoji: '💡', url: 'https://www.vitoria-gasteiz.org/wb021/was/areaAction.do?idioma=es&accion=areas&claveArea=18', grupo: 'espacio-publico' },
  { tipo: 'accesibilidad',    etiqueta: 'Accesibilidad',               emoji: '♿', url: 'https://www.vitoria-gasteiz.org/wb021/was/areaAction.do?idioma=es&accion=areas&claveArea=19', grupo: 'espacio-publico' },
  { tipo: 'otros-via',        etiqueta: 'Otros vía pública',           emoji: '📋', url: 'https://www.vitoria-gasteiz.org/wb021/was/areaAction.do?idioma=es&accion=areas&claveArea=20', grupo: 'espacio-publico' },
  // Medio ambiente
  { tipo: 'limpieza',         etiqueta: 'Limpieza pública',            emoji: '🧹', url: 'https://www.vitoria-gasteiz.org/wb021/was/areaAction.do?idioma=es&accion=areas&claveArea=22', grupo: 'medioambiente' },
  { tipo: 'reciclaje',        etiqueta: 'Reciclaje de residuos',       emoji: '♻️', url: 'https://www.vitoria-gasteiz.org/wb021/was/areaAction.do?idioma=es&accion=areas&claveArea=24', grupo: 'medioambiente' },
  { tipo: 'otros-medioambiente', etiqueta: 'Otros medio ambiente',     emoji: '🌿', url: 'https://www.vitoria-gasteiz.org/wb021/was/areaAction.do?idioma=es&accion=areas&claveArea=26', grupo: 'medioambiente' },
];

export interface ElementoMobiliario {
  id?: string;
  tipo: TipoElemento;
  barrio: string;
  coordenadas: {
    lng: number;
    lat: number;
  };
  fechaCreacion: Date;
}