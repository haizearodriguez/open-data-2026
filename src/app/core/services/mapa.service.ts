import { Injectable } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { Subject } from 'rxjs';
import { ArbolVitoriaGeoJSON, ArbolVitoriaFeature } from '../models/arbol-vitoria.model';
import { BarrioData } from '../models/barrio.model';
import { convertirGeoJsonUtmAWgs84, esPuntoEnPoligono, convertirCoordenadaUtmAWgs84, obtenerBoundsDePoligono } from '../helpers/coordenadas.helper';

@Injectable({
  providedIn: 'root'
})
export class MapaService {
  private mapa!: maplibregl.Map;
  
  private mapaClickSource = new Subject<{ lng: number; lat: number }>();
  public mapaClick$ = this.mapaClickSource.asObservable();

  constructor() {}

  /**
   * Inicializa la instancia del mapa, procesa el formato oficial de barrios y distribuye las capas
   */
  public construirMapa(container: HTMLElement, centro: [number, number], zoom: number, barrio: string): void {
    if (this.mapa) {
      this.mapa.remove();
    }

    this.mapa = new maplibregl.Map({
      container: container,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: centro,
      zoom: zoom,
      bearing: -10,
      pitch: 30,
    });

    this.mapa.addControl(new maplibregl.NavigationControl(), 'top-right');

    this.mapa.on('load', async () => {
  try {
    // 1. Cargamos el JSON oficial con formato de Esri (rings en metros UTM)
    const resBarrios = await fetch('assets/data/barrios-vitoria.json');
    const dataOficial: BarrioData = await resBarrios.json();
    
    // 2. Buscamos la feature correspondiente al barrio
    const barrioEsri = dataOficial.features.find(f => 
      f.attributes?.TEXTO?.toLowerCase() === barrio.toLowerCase()
    );

    if (barrioEsri && barrioEsri.geometry?.rings) {
      
      // REPROYECCIÓN DE LOS ANILLOS DEL BARRIO:
      // Convertimos cada coordenada UTM [X, Y] del polígono a grados decimales [Lng, Lat]
      const ringsWgs84: [number, number][][] = barrioEsri.geometry.rings.map((ring: number[][]) => 
        ring.map((coord: number[]) => {
          return convertirCoordenadaUtmAWgs84(coord[0], coord[1]);
        })
      );

      // Ahora sí armamos el Feature GeoJSON nativo compatible con MapLibre
      const barrioGeoJsonFeature = {
        type: 'Feature',
        properties: {
          nombre: barrioEsri.attributes.TEXTO,
          id_barrio: barrioEsri.attributes.BARRIO
        },
        geometry: {
          type: 'Polygon',
          coordinates: ringsWgs84 // Matriz convertida exitosamente a WGS84
        }
      };

      const coleccionBarriosGeoJson = {
        type: 'FeatureCollection',
        features: [barrioGeoJsonFeature]
      };

      // 3. DISTRIBUCIÓN Y CARGA DE CAPAS
      this.cargarCapaBarrioResaltado(coleccionBarriosGeoJson);
      this.cargarCapaEdificios3D(barrioGeoJsonFeature);
      
      // Pasamos ringsWgs84 para que el algoritmo PIP compare el arbolado en el mismo sistema de coordenadas (grados)
      this.cargarCapaArboladoVitoria(barrio, ringsWgs84);

      const bounds = obtenerBoundsDePoligono(ringsWgs84);
      
      this.mapa.fitBounds(bounds, {
        padding: 50,      // Margen en píxeles alrededor del barrio para que no toque los bordes de la pantalla
        maxZoom: 16.5,    // Evita que en barrios muy pequeños (como el Casco Viejo) el zoom se acerque demasiado
        duration: 1500    // Duración de la animación de acercamiento en milisegundos (1.5 segundos)
      });
    }

    this.configurarEventos();
  } catch (error) {
    console.error('Error durante la carga secuencial de capas:', error);
  }
});
  }

private cargarCapaEdificios3D(geojsonFeatureValido: any): void {
  if (this.mapa.getLayer('3d-buildings-barrio')) this.mapa.removeLayer('3d-buildings-barrio');

  this.mapa.addLayer({
    id: '3d-buildings-barrio',
    source: 'openmaptiles',
    'source-layer': 'building',
    type: 'fill-extrusion',
    minzoom: 13,
    // Eliminamos el filtro 'within' temporalmente para asegurar que pinte todo lo que pille
    filter: ['==', ['geometry-type'], 'Polygon'], 
    paint: {
      'fill-extrusion-color': '#94a3b8',
      
      // Sanitización estricta: Coalesce + to-number para evitar que los nulls rompan el motor
      'fill-extrusion-height': [
        'coalesce',
        ['to-number', ['get', 'render_height']],
        ['to-number', ['get', 'height']],
        15 // Si todo lo anterior es null, se le asignan 15 metros fijos
      ],
      
      'fill-extrusion-base': [
        'coalesce',
        ['to-number', ['get', 'render_min_height']],
        ['to-number', ['get', 'min_height']],
        0 // Base por defecto en el suelo
      ],
      
      'fill-extrusion-opacity': 0.85
    }
  });
}

  /**
   * Resalta el fondo del barrio usando la colección GeoJSON generada al vuelo
   */
  private cargarCapaBarrioResaltado(geojsonColeccionValida: any): void {
    if (this.mapa.getLayer('capa-barrio-resaltado')) this.mapa.removeLayer('capa-barrio-resaltado');
    if (this.mapa.getSource('barrios-vitoria-source')) this.mapa.removeSource('barrios-vitoria-source');

    this.mapa.addSource('barrios-vitoria-source', {
      type: 'geojson',
      data: geojsonColeccionValida
    });

    // 1. El relleno suave (Tipo FILL)
this.mapa.addLayer({
  id: 'capa-barrio-resaltado',
  type: 'fill', // <-- Tipo Fill
  source: 'barrios-vitoria-source',
  paint: {
    'fill-color': 'red',
    'fill-opacity': 0.08
  }
});

// 2. El contorno (Tipo LINE)
this.mapa.addLayer({
  id: 'capa-barrio-borde',
  type: 'line', // <-- Tipo Line obligatorio para usar line-width
  source: 'barrios-vitoria-source',
  paint: {
    'line-color': '#00e676',
    'line-width': 5,
    'line-opacity': 0.9
  }
});
  }

  /**
   * Recorta el censo de arbolado basándose en la matriz de anillos oficial casteada
   */
  private async cargarCapaArboladoVitoria(nombreBarrio: string, ringsPoligono: number[][][]): Promise<void> {
    try {
      if (!ringsPoligono) return;

      const resArbolado = await fetch('assets/data/arbolado-vitoria.json');
      const arboladoOriginal: ArbolVitoriaGeoJSON = await resArbolado.json();
      const arboladoWgs84: ArbolVitoriaGeoJSON = convertirGeoJsonUtmAWgs84(arboladoOriginal);

      // Casteamos ringsPoligono para cumplir con el tipado estricto de TypeScript
      const poligonoTipado = ringsPoligono as unknown as [number, number][][];

      // Filtrado Punto en Polígono (PIP)
      const arbolesFiltrados = arboladoWgs84.features.filter((arbol: ArbolVitoriaFeature) => {
        const coordsPunto = arbol.geometry.coordinates;
        return esPuntoEnPoligono(coordsPunto, poligonoTipado);
      });

      console.log(`[GIS Oficial] Árboles renderizados en ${nombreBarrio}: ${arbolesFiltrados.length}`);

      const geojsonFinal: ArbolVitoriaGeoJSON = {
        type: 'FeatureCollection',
        features: arbolesFiltrados
      };

      if (this.mapa.getSource('arbolado-vitoria-source')) this.mapa.removeSource('arbolado-vitoria-source');

      this.mapa.addSource('arbolado-vitoria-source', {
        type: 'geojson',
        data: geojsonFinal
      });

      this.mapa.addLayer({
        id: 'capa-arboles-vitoria',
        type: 'circle',
        source: 'arbolado-vitoria-source',
        minzoom: 13,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2, 18, 9],
          'circle-color': [
            'match',
            ['coalesce', ['get', 'PRESENCIA'], 'SI'],
            'SI', '#00e676',
            'FALTA', '#ff9100',
            '#00e676'
          ],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff'
        }
      });

    } catch (error) {
      console.error('Error al computar el filtrado espacial del arbolado:', error);
    }
  }

  public agregarMarcadorMobiliario(lng: number, lat: number, tipo: 'arbol' | 'banco' | 'farola' | 'papelera'): void {
    const elemento = document.createElement('div');
    elemento.style.fontSize = '32px';
    elemento.style.transform = 'translateY(-16px)';
    elemento.style.cursor = 'pointer';
    if (tipo === 'arbol') elemento.innerHTML = '🌳';
    else if (tipo === 'banco') elemento.innerHTML = '🪑';
    else if (tipo === 'farola') elemento.innerHTML = '💡';
    else elemento.innerHTML = '♻️';
    new maplibregl.Marker({ element: elemento }).setLngLat([lng, lat]).addTo(this.mapa);
  }

  public agregarMarcadorEstatico(lng: number, lat: number, color: string = '#2dd36f'): void {
    new maplibregl.Marker({ color }).setLngLat([lng, lat]).addTo(this.mapa);
  }

  private configurarEventos(): void {
    this.mapa.on('click', (evento: maplibregl.MapMouseEvent) => {
      this.mapaClickSource.next({ lng: evento.lngLat.lng, lat: evento.lngLat.lat });
    });

    this.mapa.on('click', 'capa-arboles-vitoria', (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const f = e.features?.[0];
      const props = f?.properties;
      const coords = (f?.geometry as any)?.coordinates;
      if (!props || !coords) return;

      new maplibregl.Popup()
        .setLngLat(coords as [number, number])
        .setHTML(`<h3>🌳 ${props['ESPECIE'] || 'Árbol Urbano'}</h3><p>Estado en censo: ${props['PRESENCIA']}</p>`)
        .addTo(this.mapa);
    });
  }

  public destruirMapa(): void {
    if (this.mapa) this.mapa.remove();
  }
}