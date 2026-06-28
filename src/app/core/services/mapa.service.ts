import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as maplibregl from 'maplibre-gl';
import { Observable, Subject, shareReplay, firstValueFrom } from 'rxjs';
import { ArbolVitoriaGeoJSON, ArbolVitoriaFeature } from '../models/arbol-vitoria.model';
import { BarrioData } from '../models/barrio.model';
import { CategoriaElemento, TipoElemento } from '../models/mobiliario.model';
import { convertirGeoJsonUtmAWgs84, esPuntoEnPoligono, convertirCoordenadaUtmAWgs84, obtenerBoundsDePoligono } from '../helpers/coordenadas.helper';

// IDs de capas y fuentes de datos por categoría.
// Añadir aquí cuando se incorporen nuevos datasets.
const CAPAS_CATEGORIA: Record<string, { layerIds: string[]; sourceIds: string[] }> = {
  'zona-verde':        { layerIds: ['capa-arboles-vitoria'],  sourceIds: ['arbolado-vitoria-source'] },
  'alumbrado':         { layerIds: ['capa-alumbrado'],         sourceIds: ['alumbrado-source'] },
  'mobiliario':        { layerIds: ['capa-mobiliario-urbano'], sourceIds: ['mobiliario-urbano-source'] },
  'desperfecto':       { layerIds: [],                         sourceIds: [] },
  'obras':             { layerIds: [],                         sourceIds: [] },
  'ocupacion':         { layerIds: [],                         sourceIds: [] },
  'accesibilidad':     { layerIds: [],                         sourceIds: [] },
  'otros-via':         { layerIds: [],                         sourceIds: [] },
  'limpieza':          { layerIds: [],                         sourceIds: [] },
  'reciclaje':         { layerIds: [],                         sourceIds: [] },
  'otros-medioambiente': { layerIds: [],                       sourceIds: [] },
};

@Injectable({
  providedIn: 'root'
})
export class MapaService {
  private mapa!: maplibregl.Map;

  private mapaClickSource = new Subject<{ lng: number; lat: number }>();
  public mapaClick$ = this.mapaClickSource.asObservable();

  // Emite los rings WGS84 del barrio activo para que la página pueda usarlos
  private ringsBarrioSource = new Subject<[number, number][][]>();
  public ringsBarrio$ = this.ringsBarrioSource.asObservable();

  // Caché del JSON de barrios: la petición se hace una sola vez
  private barrios$: Observable<BarrioData> | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Devuelve el JSON de barrios. La primera llamada lanza la petición HTTP;
   * las siguientes reciben el resultado cacheado sin nueva petición.
   */
  public getBarrios(): Observable<BarrioData> {
    if (!this.barrios$) {
      this.barrios$ = this.http
        .get<BarrioData>('assets/data/barrios-vitoria.json')
        .pipe(shareReplay(1));
    }
    return this.barrios$;
  }

  /**
   * Inicializa el mapa y carga las capas base del barrio (polígono + edificios).
   * NO carga datos de categoría — eso lo hace cargarCapaParaCategoria().
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
        const dataOficial: BarrioData = await firstValueFrom(this.getBarrios());

        const barrioEsri = dataOficial.features.find(f =>
          f.attributes?.TEXTO?.toLowerCase() === barrio.toLowerCase()
        );

        if (barrioEsri && barrioEsri.geometry?.rings) {

          const ringsWgs84: [number, number][][] = barrioEsri.geometry.rings.map((ring: number[][]) =>
            ring.map((coord: number[]) => convertirCoordenadaUtmAWgs84(coord[0], coord[1]))
          );

          const barrioGeoJsonFeature = {
            type: 'Feature',
            properties: {
              nombre: barrioEsri.attributes.TEXTO,
              id_barrio: barrioEsri.attributes.BARRIO
            },
            geometry: {
              type: 'Polygon',
              coordinates: ringsWgs84
            }
          };

          this.cargarCapaBarrioResaltado({ type: 'FeatureCollection', features: [barrioGeoJsonFeature] });
          this.cargarCapaEdificios3D(barrioGeoJsonFeature);

          const bounds = obtenerBoundsDePoligono(ringsWgs84);
          this.mapa.fitBounds(bounds, { padding: 50, maxZoom: 16.5, duration: 1500 });

          // Emite los rings para que mapa.page los almacene y los pase a cargarCapaParaCategoria()
          this.ringsBarrioSource.next(ringsWgs84);
        }

        this.configurarEventos();

      } catch (error) {
        console.error('Error durante la carga del mapa:', error);
      }
    });
  }

  /**
   * Router de capas de datos: carga la capa correspondiente a la categoría elegida.
   * Limpia automáticamente las capas de la categoría anterior.
   * Añadir nuevos casos aquí cuando haya más datasets disponibles.
   */
  public cargarCapaParaCategoria(tipo: TipoElemento, barrio: string, rings: [number, number][][]): void {
    this.limpiarCapasCategoria();

    switch (tipo) {
      case 'zona-verde':
        this.cargarCapaArboladoVitoria(barrio, rings);
        break;

      case 'alumbrado':
        // TODO: descomentar cuando esté disponible el GeoJSON de alumbrado
        // this.cargarCapaAlumbrado(barrio, rings);
        console.info('[MapaService] Capa de alumbrado pendiente de datos');
        break;

      case 'mobiliario':
        // TODO: descomentar cuando esté disponible el GeoJSON de mobiliario urbano
        // this.cargarCapaMobiliarioUrbano(barrio, rings);
        console.info('[MapaService] Capa de mobiliario urbano pendiente de datos');
        break;

      case 'desperfecto':
      case 'fuente':
      case 'accesibilidad':
      case 'otros-via':
      case 'limpieza':
      case 'reciclaje':
      case 'otros-medioambiente':
        // Sin capa de datos por ahora — el marcador del usuario es suficiente
        break;
    }
  }

  /**
   * Elimina del mapa todas las capas y fuentes de datos de categoría conocidas.
   * Se llama automáticamente antes de cargar una nueva categoría.
   */
  private limpiarCapasCategoria(): void {
    const todasCapas   = Object.values(CAPAS_CATEGORIA).flatMap(c => c.layerIds);
    const todasFuentes = Object.values(CAPAS_CATEGORIA).flatMap(c => c.sourceIds);

    todasCapas.forEach(id => {
      if (this.mapa.getLayer(id)) this.mapa.removeLayer(id);
    });
    todasFuentes.forEach(id => {
      if (this.mapa.getSource(id)) this.mapa.removeSource(id);
    });
  }

  // ─── Capas base ──────────────────────────────────────────────────────────────

  private cargarCapaEdificios3D(geojsonFeature: any): void {
    if (this.mapa.getLayer('3d-buildings-barrio')) this.mapa.removeLayer('3d-buildings-barrio');

    this.mapa.addLayer({
      id: '3d-buildings-barrio',
      source: 'openmaptiles',
      'source-layer': 'building',
      type: 'fill-extrusion',
      minzoom: 13,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-extrusion-color': '#94a3b8',
        'fill-extrusion-height': ['coalesce', ['to-number', ['get', 'render_height']], ['to-number', ['get', 'height']], 15],
        'fill-extrusion-base':   ['coalesce', ['to-number', ['get', 'render_min_height']], ['to-number', ['get', 'min_height']], 0],
        'fill-extrusion-opacity': 0.85
      }
    });
  }

  private cargarCapaBarrioResaltado(geojsonColeccion: any): void {
    if (this.mapa.getLayer('capa-barrio-resaltado')) this.mapa.removeLayer('capa-barrio-resaltado');
    if (this.mapa.getLayer('capa-barrio-borde'))     this.mapa.removeLayer('capa-barrio-borde');
    if (this.mapa.getSource('barrios-vitoria-source')) this.mapa.removeSource('barrios-vitoria-source');

    this.mapa.addSource('barrios-vitoria-source', { type: 'geojson', data: geojsonColeccion });

    this.mapa.addLayer({
      id: 'capa-barrio-resaltado', type: 'fill', source: 'barrios-vitoria-source',
      paint: { 'fill-color': 'red', 'fill-opacity': 0.08 }
    });

    this.mapa.addLayer({
      id: 'capa-barrio-borde', type: 'line', source: 'barrios-vitoria-source',
      paint: { 'line-color': '#00e676', 'line-width': 5, 'line-opacity': 0.9 }
    });
  }

  // ─── Capas de categoría ───────────────────────────────────────────────────────

  private async cargarCapaArboladoVitoria(nombreBarrio: string, ringsPoligono: [number, number][][]): Promise<void> {
    try {
      const resArbolado = await fetch('assets/data/arbolado-vitoria.json');
      const arboladoOriginal: ArbolVitoriaGeoJSON = await resArbolado.json();
      const arboladoWgs84: ArbolVitoriaGeoJSON = convertirGeoJsonUtmAWgs84(arboladoOriginal);

      const arbolesFiltrados = arboladoWgs84.features.filter((arbol: ArbolVitoriaFeature) =>
        esPuntoEnPoligono(arbol.geometry.coordinates, ringsPoligono)
      );

      console.log(`[GIS] Árboles en ${nombreBarrio}: ${arbolesFiltrados.length}`);

      this.mapa.addSource('arbolado-vitoria-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: arbolesFiltrados }
      });

      this.mapa.addLayer({
        id: 'capa-arboles-vitoria',
        type: 'circle',
        source: 'arbolado-vitoria-source',
        minzoom: 13,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2, 18, 9],
          'circle-color': ['match', ['coalesce', ['get', 'PRESENCIA'], 'SI'], 'SI', '#00e676', 'FALTA', '#ff9100', '#00e676'],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff'
        }
      });

    } catch (error) {
      console.error('Error al cargar la capa de arbolado:', error);
    }
  }

  // ─── Marcadores y eventos ─────────────────────────────────────────────────────

  public agregarMarcadorMobiliario(lng: number, lat: number, categoria: CategoriaElemento): void {
    const elemento = document.createElement('div');
    elemento.style.fontSize = '28px';
    elemento.style.transform = 'translateY(-14px)';
    elemento.style.cursor = 'pointer';
    elemento.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';
    elemento.title = categoria.etiqueta;
    elemento.innerHTML = categoria.emoji;
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