import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as maplibregl from 'maplibre-gl';
import {
  Observable,
  Subject,
  shareReplay,
  firstValueFrom
} from 'rxjs';

import {
  ArbolVitoriaGeoJSON,
  ArbolVitoriaFeature
} from '../models/arbol-vitoria.model';

import { BarrioData } from '../models/barrio.model';

import {
  CategoriaElemento,
  TipoElemento
} from '../models/mobiliario.model';

import {
  convertirGeoJsonUtmAWgs84,
  esPuntoEnPoligono,
  convertirCoordenadaUtmAWgs84,
  convertirWgs84AUtm30,
  obtenerBoundsDePoligono
} from '../helpers/coordenadas.helper';

const CAPAS_CATEGORIA: Record<
  string,
  {
    layerIds: string[];
    sourceIds: string[];
  }
> = {
  'zona-verde': {
    layerIds: ['capa-arboles-vitoria'],
    sourceIds: ['arbolado-vitoria-source']
  },

  'alumbrado': {
    layerIds: ['capa-alumbrado'],
    sourceIds: ['alumbrado-source']
  },

  'mobiliario': {
    layerIds: ['capa-mobiliario-urbano'],
    sourceIds: ['mobiliario-urbano-source']
  },

  'desperfecto': {
    layerIds: [],
    sourceIds: []
  },

  'fuente': {
    layerIds: [],
    sourceIds: []
  },

  'accesibilidad': {
    layerIds: [],
    sourceIds: []
  },

  'otros-via': {
    layerIds: [],
    sourceIds: []
  },

  'limpieza': {
    layerIds: [],
    sourceIds: []
  },

  'reciclaje': {
    layerIds: [],
    sourceIds: []
  },

  'otros-medioambiente': {
    layerIds: [],
    sourceIds: []
  }
};

interface MarcadorRegistrado {
  id: string;
  marker: maplibregl.Marker;
  lng: number;
  lat: number;
}

@Injectable({
  providedIn: 'root'
})
export class MapaService {

  private mapa!: maplibregl.Map;

  private mapaClickSource =
    new Subject<{
      lng: number;
      lat: number;
    }>();

  public mapaClick$ =
    this.mapaClickSource.asObservable();

  private ringsBarrioSource =
    new Subject<[number, number][][]>();

  public ringsBarrio$ =
    this.ringsBarrioSource.asObservable();

  private marcadores: MarcadorRegistrado[] = [];

  private modoEliminar = false;

  /** Indica que hay una propuesta abierta en la pantalla Tu propuesta. */
  private propuestaEnEdicion = false;

  private barrios$: Observable<BarrioData> | null = null;

  constructor(
    private http: HttpClient
  ) {}

  public marcarPropuestaEnEdicion(): void {
    this.propuestaEnEdicion = true;
  }

  public estaPropuestaEnEdicion(): boolean {
    return this.propuestaEnEdicion;
  }

  public finalizarPropuesta(): void {
    this.propuestaEnEdicion = false;
  }

  public getBarrios(): Observable<BarrioData> {

    if (!this.barrios$) {

      this.barrios$ =
        this.http
          .get<BarrioData>(
            'assets/data/barrios-vitoria.json'
          )
          .pipe(
            shareReplay(1)
          );
    }

    return this.barrios$;
  }

  public agregarMarcadorEstatico(
    lng: number,
    lat: number,
    color: string = '#2dd36f'
  ): void {
    new maplibregl.Marker({ color })
      .setLngLat([lng, lat])
      .addTo(this.mapa);
  }

  public construirMapa(
    container: HTMLElement,
    centro: [number, number],
    zoom: number,
    barrio: string
  ): Promise<void> {

    try {

      if (this.mapa) {
        this.mapa.remove();
      }

    } catch {
      // El mapa ya estaba destruido.
    }

    this.marcadores = [];
    this.modoEliminar = false;

    return new Promise<void>((resolve) => {

      this.mapa =
        new maplibregl.Map({
          container,
          style:
            'https://tiles.openfreemap.org/styles/positron',
          center: centro,
          zoom,
          bearing: -10,
          pitch: 30
        });

      this.mapa.addControl(
        new maplibregl.NavigationControl(),
        'top-right'
      );

      this.mapa.on(
        'load',
        async () => {

          try {

            const dataOficial: BarrioData =
              await firstValueFrom(
                this.getBarrios()
              );

            const barrioEsri =
              dataOficial.features.find(
                f =>
                  f.attributes?.TEXTO?.toLowerCase() ===
                  barrio.toLowerCase()
              );

            if (
              barrioEsri &&
              barrioEsri.geometry?.rings
            ) {

              const ringsWgs84:
                [number, number][][] =
                barrioEsri.geometry.rings.map(
                  (ring: number[][]) =>
                    ring.map(
                      (coord: number[]) =>
                        convertirCoordenadaUtmAWgs84(
                          coord[0],
                          coord[1]
                        )
                    )
                );

              const barrioGeoJsonFeature = {
                type: 'Feature',
                properties: {
                  nombre:
                    barrioEsri.attributes.TEXTO,

                  id_barrio:
                    barrioEsri.attributes.BARRIO
                },

                geometry: {
                  type: 'Polygon',
                  coordinates: ringsWgs84
                }
              };

              this.cargarCapaBarrioResaltado({
                type: 'FeatureCollection',
                features: [
                  barrioGeoJsonFeature
                ]
              });

              this.cargarCapaEdificios3D();

              const bounds =
                obtenerBoundsDePoligono(
                  ringsWgs84
                );

              this.mapa.fitBounds(
                bounds,
                {
                  padding: 50,
                  maxZoom: 16.5,
                  duration: 1500
                }
              );

              this.ringsBarrioSource.next(
                ringsWgs84
              );
            }

            this.configurarEventos();

          } catch {

          } finally {

            resolve();
          }
        }
      );
    });
  }

  public async obtenerBarrioPorCoordenadas(
    lng: number,
    lat: number
  ): Promise<string | null> {

    if (
      !Number.isFinite(lng) ||
      !Number.isFinite(lat)
    ) {
      return null;
    }

    try {

      // GPS WGS84 → UTM 30N

      const [x, y] =
        convertirWgs84AUtm30(
          lng,
          lat
        );

      const data =
        await firstValueFrom(
          this.getBarrios()
        );

      // 1. BUSCAR BARRIO EXACTO

      for (
        const feature of data.features
      ) {

        if (
          !feature.geometry?.rings
        ) {
          continue;
        }

        const estaDentro =
          esPuntoEnPoligono(
            [x, y],
            feature.geometry.rings as [
              number,
              number
            ][][]
          );

        if (estaDentro) {

          const barrio =
            feature.attributes
              ?.TEXTO
              ?.trim();

          return barrio || null;
        }
      }

      // 2. NO ESTÁ DENTRO
      //
      // Buscar el barrio cuya frontera
      // esté más cerca.

      let barrioMasCercano:
        string | null = null;

      let distanciaMinima =
        Infinity;

      for (
        const feature of data.features
      ) {

        if (
          !feature.geometry?.rings
        ) {
          continue;
        }

        for (
          const ring of feature.geometry.rings
        ) {

          for (
            let i = 0;
            i < ring.length - 1;
            i++
          ) {

            const p1 =
              ring[i];

            const p2 =
              ring[i + 1];

            const distancia =
              distanciaPuntoASegmentoUtm(
                x,
                y,
                p1[0],
                p1[1],
                p2[0],
                p2[1]
              );

            if (
              distancia <
              distanciaMinima
            ) {

              distanciaMinima =
                distancia;

              barrioMasCercano =
                feature
                  .attributes
                  ?.TEXTO
                  ?.trim() || null;
            }
          }
        }
      }

      // 3. TOLERANCIA GPS

      const toleranciaMetros =
        20;

      if (
        barrioMasCercano &&
        distanciaMinima <=
        toleranciaMetros
      ) {
        return barrioMasCercano;
      }

      return null;

    } catch {

      return null;
    }
  }

  // ─── Modo eliminación ─────────────────────────────

  public activarModoEliminar(): void {

    this.modoEliminar = true;

    this.marcadores.forEach(
      m => {

        const el =
          m.marker.getElement();

        el.style.outline =
          '3px dashed #e53935';

        el.style.borderRadius =
          '4px';

        el.style.cursor =
          'crosshair';
      }
    );
  }

  public desactivarModoEliminar(): void {

    this.modoEliminar = false;

    this.marcadores.forEach(
      m => {

        const el =
          m.marker.getElement();

        el.style.outline = '';
        el.style.cursor =
          'pointer';
      }
    );
  }

  public eliminarMarcadorPorId(
    id: string
  ): void {

    const idx =
      this.marcadores.findIndex(
        m => m.id === id
      );

    if (idx === -1) {
      return;
    }

    this.marcadores[idx]
      .marker
      .remove();

    this.marcadores.splice(
      idx,
      1
    );
  }

  // ─── Marcadores ───────────────────────────────────

  public agregarMarcadorMobiliario(
    lng: number,
    lat: number,
    categoria: CategoriaElemento,
    onEliminar?: (id: string) => void,
    idExistente?: string
  ): string {

    const id =
      idExistente ??
      `marcador-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

    const elemento =
      document.createElement('div');

    elemento.style.fontSize =
      '28px';

    elemento.style.transform =
      'translateY(-14px)';

    elemento.style.cursor =
      'pointer';

    elemento.style.filter =
      'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';

    elemento.title =
      categoria.etiqueta;

    elemento.innerHTML =
      categoria.emoji;

    elemento.dataset['id'] =
      id;

    elemento.addEventListener(
      'click',
      (e) => {

        e.stopPropagation();

        if (
          this.modoEliminar &&
          onEliminar
        ) {
          onEliminar(id);
        }
      }
    );

    const marker =
      new maplibregl.Marker({
        element: elemento
      })
        .setLngLat([lng, lat])
        .addTo(this.mapa);

    this.marcadores.push({
      id,
      marker,
      lng,
      lat
    });

    return id;
  }

  // ─── Capas de categoría ──────────────────────────

  public cargarCapaParaCategoria(
    tipo: TipoElemento,
    rings: [number, number][][]
  ): void {

    this.limpiarCapasCategoria();

    switch (tipo) {

      case 'zona-verde':
        this.cargarCapaArboladoVitoria(
          rings
        );
        break;

      case 'alumbrado':
      case 'mobiliario':
      default:
        break;
    }
  }

  private limpiarCapasCategoria(): void {

    const todasCapas =
      Object.values(
        CAPAS_CATEGORIA
      ).flatMap(
        c => c.layerIds
      );

    const todasFuentes =
      Object.values(
        CAPAS_CATEGORIA
      ).flatMap(
        c => c.sourceIds
      );

    todasCapas.forEach(
      id => {

        if (
          this.mapa?.getLayer(id)
        ) {
          this.mapa.removeLayer(id);
        }
      }
    );

    todasFuentes.forEach(
      id => {

        if (
          this.mapa?.getSource(id)
        ) {
          this.mapa.removeSource(id);
        }
      }
    );
  }

  // ─── Capas base ───────────────────────────────────

  private cargarCapaEdificios3D(): void {

    if (
      this.mapa.getLayer(
        '3d-buildings-barrio'
      )
    ) {
      this.mapa.removeLayer(
        '3d-buildings-barrio'
      );
    }

    this.mapa.addLayer({
      id:
        '3d-buildings-barrio',

      source:
        'openmaptiles',

      'source-layer':
        'building',

      type:
        'fill-extrusion',

      minzoom:
        13,

      filter: [
        '==',
        ['geometry-type'],
        'Polygon'
      ],

      paint: {

        'fill-extrusion-color':
          '#94a3b8',

        'fill-extrusion-height': [
          'coalesce',
          [
            'to-number',
            ['get', 'render_height']
          ],
          [
            'to-number',
            ['get', 'height']
          ],
          15
        ],

        'fill-extrusion-base': [
          'coalesce',
          [
            'to-number',
            ['get', 'render_min_height']
          ],
          [
            'to-number',
            ['get', 'min_height']
          ],
          0
        ],

        'fill-extrusion-opacity':
          0.85
      }
    });
  }

  private cargarCapaBarrioResaltado(
    geojsonColeccion: any
  ): void {

    if (
      this.mapa.getLayer(
        'capa-barrio-resaltado'
      )
    ) {
      this.mapa.removeLayer(
        'capa-barrio-resaltado'
      );
    }

    if (
      this.mapa.getLayer(
        'capa-barrio-borde'
      )
    ) {
      this.mapa.removeLayer(
        'capa-barrio-borde'
      );
    }

    if (
      this.mapa.getSource(
        'barrios-vitoria-source'
      )
    ) {
      this.mapa.removeSource(
        'barrios-vitoria-source'
      );
    }

    this.mapa.addSource(
      'barrios-vitoria-source',
      {
        type: 'geojson',
        data: geojsonColeccion
      }
    );

    this.mapa.addLayer({
      id:
        'capa-barrio-resaltado',

      type:
        'fill',

      source:
        'barrios-vitoria-source',

      paint: {
        'fill-color':
          'red',

        'fill-opacity':
          0.08
      }
    });

    this.mapa.addLayer({
      id:
        'capa-barrio-borde',

      type:
        'line',

      source:
        'barrios-vitoria-source',

      paint: {
        'line-color':
          '#00e676',

        'line-width':
          5,

        'line-opacity':
          0.9
      }
    });
  }

  private async cargarCapaArboladoVitoria(
    ringsPoligono: [number, number][][]
  ): Promise<void> {

    try {

      const resArbolado =
        await fetch(
          'assets/data/arbolado-vitoria.json'
        );

      const arboladoOriginal:
        ArbolVitoriaGeoJSON =
        await resArbolado.json();

      const arboladoWgs84:
        ArbolVitoriaGeoJSON =
        convertirGeoJsonUtmAWgs84(
          arboladoOriginal
        );

      const arbolesFiltrados =
        arboladoWgs84.features.filter(
          (
            arbol: ArbolVitoriaFeature
          ) =>
            esPuntoEnPoligono(
              arbol.geometry.coordinates,
              ringsPoligono
            )
        );

      this.mapa.addSource(
        'arbolado-vitoria-source',
        {
          type: 'geojson',

          data: {
            type:
              'FeatureCollection',

            features:
              arbolesFiltrados
          }
        }
      );

      this.mapa.addLayer({

        id:
          'capa-arboles-vitoria',

        type:
          'circle',

        source:
          'arbolado-vitoria-source',

        minzoom:
          13,

        paint: {

          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            13,
            2,
            18,
            9
          ],

          'circle-color': [
            'match',
            [
              'coalesce',
              [
                'get',
                'PRESENCIA'
              ],
              'SI'
            ],
            'SI',
            '#00e676',
            'FALTA',
            '#ff9100',
            '#00e676'
          ],

          'circle-opacity':
            0.85,

          'circle-stroke-width':
            1,

          'circle-stroke-color':
            '#ffffff'
        }
      });

    } catch {
      // No se pudo cargar la capa de arbolado.
    }
  }

  // ─── Eventos ──────────────────────────────────────

  private configurarEventos(): void {

    this.mapa.on(
      'click',
      (
        evento: maplibregl.MapMouseEvent
      ) => {

        this.mapaClickSource.next({
          lng:
            evento.lngLat.lng,

          lat:
            evento.lngLat.lat
        });
      }
    );

    this.mapa.on(
      'click',
      'capa-arboles-vitoria',
      (
        e: maplibregl.MapMouseEvent & {
          features?:
            maplibregl.MapGeoJSONFeature[];
        }
      ) => {

        const f =
          e.features?.[0];

        const props =
          f?.properties;

        const coords =
          (
            f?.geometry as any
          )?.coordinates;

        if (
          !props ||
          !coords
        ) {
          return;
        }

        new maplibregl.Popup()
          .setLngLat(
            coords as [number, number]
          )
          .setHTML(
            `<h3>🌳 ${
              props['ESPECIE'] ||
              'Árbol Urbano'
            }</h3>
            <p>
              Estado en censo:
              ${props['PRESENCIA']}
            </p>`
          )
          .addTo(this.mapa);
      }
    );
  }

  // ─── Destrucción ─────────────────────────────────

  public destruirMapa(): void {

    try {

      this.mapa?.remove();

    } catch {
      // El mapa ya estaba destruido.
    }

    this.marcadores = [];
  }
}

// ─── Distancia a punto ──────────────────────────────

function distanciaPuntoASegmentoUtm(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {

  const dx =
    x2 - x1;

  const dy =
    y2 - y1;

  if (
    dx === 0 &&
    dy === 0
  ) {

    return Math.sqrt(
      Math.pow(
        px - x1,
        2
      ) +
      Math.pow(
        py - y1,
        2
      )
    );
  }

  let t =
    (
      (px - x1) * dx +
      (py - y1) * dy
    ) /
    (
      dx * dx +
      dy * dy
    );

  t =
    Math.max(
      0,
      Math.min(
        1,
        t
      )
    );

  const puntoX =
    x1 + t * dx;

  const puntoY =
    y1 + t * dy;

  return Math.sqrt(
    Math.pow(
      px - puntoX,
      2
    ) +
    Math.pow(
      py - puntoY,
      2
    )
  );
}