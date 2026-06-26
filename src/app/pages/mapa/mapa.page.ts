import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { 
  IonContent, 
  IonHeader, 
  IonTitle, 
  IonToolbar, 
  IonButtons, 
  IonBackButton,
  IonFab,
  IonFabButton,
  IonFabList,
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { hammerOutline, closeOutline, leafOutline } from 'ionicons/icons';
import * as maplibregl from 'maplibre-gl';

@Component({
  selector: 'app-mapa',
  templateUrl: './mapa.page.html',
  styleUrls: ['./mapa.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonFab,
    IonFabButton,
    IonFabList,
    IonIcon
  ]
})
export class MapaPage implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  
  mapa!: maplibregl.Map;
  coordenadasMatch: { lat: number; lng: number } | null = null;
  
  modoPlantar: boolean = false;
  tipoElementoSeleccionado: 'arbol' | 'banco' | 'farola' | 'papelera' = 'arbol';

  constructor(private router: Router) {
    addIcons({ hammerOutline, closeOutline, leafOutline });

    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state && navigation.extras.state['coordenadas']) {
      this.coordenadasMatch = navigation.extras.state['coordenadas'];
    }
  }

  ngOnInit() {}

  ionViewDidEnter() {
    this.inicializarMapa();
  }

  inicializarMapa() {
    if (this.mapa) return;

    let centroPorDefecto: [number, number] = [-2.67268, 42.84695]; 
    let zoomPorDefecto = 13;

    if (this.coordenadasMatch) {
      centroPorDefecto = [this.coordenadasMatch.lng, this.coordenadasMatch.lat];
      zoomPorDefecto = 16.5; 
    }

    this.mapa = new maplibregl.Map({
      container: this.mapContainer.nativeElement,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: centroPorDefecto,
      zoom: zoomPorDefecto,
      pitch: 60, 
      bearing: -10
    });

    this.mapa.addControl(new maplibregl.NavigationControl(), 'top-right');

    this.mapa.on('load', async () => {
      this.mapa.addLayer({
        id: '3d-buildings',
        source: 'openmaptiles',
        'source-layer': 'building', 
        type: 'fill-extrusion',
        minzoom: 15, 
        paint: {
          'fill-extrusion-color': 'rgba(180, 200, 220, 0.6)',
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            15.5, ['get', 'render_height']
          ],
          'fill-extrusion-base': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            15.5, ['get', 'render_min_height']
          ],
          'fill-extrusion-opacity': 0.85
        }
      });

      try {
        const respuesta = await fetch('assets/data/arbolado-vitoria.json');
        const jsonOriginal = await respuesta.json();
        
        // Llamada corregida sin caracteres matemáticos en el nombre
        const jsonCorregido = this.convertirGeoJsonUtmAWgs84(jsonOriginal);

        this.mapa.addSource('arbolado-vitoria-source', {
          type: 'geojson',
          data: jsonCorregido
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
              ['get', 'PRESENCIA'],
              'SI', '#00e676',
              'FALTA', '#ff9100',
              '#00e676' 
            ],
            'circle-opacity': 0.75,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff'
          }
        });
      } catch (error) {
        console.error('Error al procesar el censo:', error);
      }

      if (this.coordenadasMatch) {
        new maplibregl.Marker({ color: '#2dd36f' }) 
          .setLngLat([this.coordenadasMatch.lng, this.coordenadasMatch.lat])
          .addTo(this.mapa);
      }

      this.configurarEventosClick();
    });
  }

  private convertirGeoJsonUtmAWgs84(geojson: any): any {
    if (!geojson || !geojson.features) return geojson;

    const featuresCorregidas = geojson.features
      .map((f: any) => {
        if (!f.geometry || !f.geometry.coordinates) return null;
        
        const x = f.geometry.coordinates[0];
        const y = f.geometry.coordinates[1];

        if (!x || !y || isNaN(x) || isNaN(y)) return null;

        const lonCentral = -3.0; 
        const a = 6378137.0; 
        const fMod = 1 / 298.257223563;
        const b = a * (1 - fMod);
        const e2 = (Math.pow(a,2) - Math.pow(b,2)) / Math.pow(a,2);
        const ePrime2 = (Math.pow(a,2) - Math.pow(b,2)) / Math.pow(b,2);
        
        const utmX = x - 500000;
        const utmY = y;
        
        const M = utmY / 0.9996;
        const mu = M / (a * (1 - e2/4 - 3*e2*e2/64 - 5*e2*e2/256));
        
        const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
        const J1 = (3*e1/2 - 27*e1*e1*e1/32);
        const J2 = (21*e1*e1/16 - 55*e1*e1*e1*e1/32);
        const J3 = (151*e1*e1*e1/96);
        
        const fp = mu + J1*Math.sin(2*mu) + J2*Math.sin(4*mu) + J3*Math.sin(6*mu);
        
        const C1 = ePrime2 * Math.pow(Math.cos(fp), 2);
        const T1 = Math.pow(Math.tan(fp), 2);
        const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.pow(Math.sin(fp), 2), 1.5);
        const N1 = a / Math.sqrt(1 - e2 * Math.pow(Math.sin(fp), 2));
        const D = utmX / (N1 * 0.9996);
        
        let lat = fp - (N1 * Math.tan(fp) / R1) * (Math.pow(D, 2) / 2 - (5 + 3 * T1 + 10 * C1 - 4 * Math.pow(C1, 2) - 9 * ePrime2) * Math.pow(D, 4) / 24);
        let lng = (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 + (5 - 2 * C1 + 28 * T1 - 3 * Math.pow(C1, 2) + 8 * ePrime2 + 24 * Math.pow(T1, 2)) * Math.pow(D, 5) / 120) / Math.cos(fp);
        
        lat = lat * (180 / Math.PI);
        lng = (lng * (180 / Math.PI)) + lonCentral;

        return {
          ...f,
          geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          }
        };
      })
      .filter((f: any) => f !== null);

    return {
      type: 'FeatureCollection',
      features: featuresCorregidas
    };
  }

  conmutarModoPlantar() {
    this.modoPlantar = !this.modoPlantar;
  }

  seleccionarHerramienta(tipo: 'arbol' | 'banco' | 'farola' | 'papelera') {
    this.modoPlantar = true;
    this.tipoElementoSeleccionado = tipo;
  }

  configurarEventosClick() {
    // Tipado explícito de los argumentos del evento del mapa para evitar implicit 'any'
    this.mapa.on('click', (evento: maplibregl.MapMouseEvent) => {
      if (!this.modoPlantar) return;
      const coordenadasClick = evento.lngLat;
      this.plantarMobiliarioVirtual(coordenadasClick.lng, coordenadasClick.lat);
    });

    this.mapa.on('click', 'capa-arboles-vitoria', (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      
      const props = f.properties;
      const coords = (f.geometry as any).coordinates;
      if (!props || !coords) return;

      new maplibregl.Popup()
        .setLngLat(coords as [number, number])
        .setHTML(`<h3>🌳 ${props['ESPECIE'] || 'Árbol'}</h3>`)
        .addTo(this.mapa);
    });
  }

  plantarMobiliarioVirtual(lng: number, lat: number) {
    const elementoMobiliario = document.createElement('div');
    elementoMobiliario.style.fontSize = '32px';
    elementoMobiliario.style.transform = 'translateY(-16px)';

    if (this.tipoElementoSeleccionado === 'arbol') elementoMobiliario.innerHTML = '🌳';
    else if (this.tipoElementoSeleccionado === 'banco') elementoMobiliario.innerHTML = '🪑';
    else if (this.tipoElementoSeleccionado === 'farola') elementoMobiliario.innerHTML = '💡';
    else elementoMobiliario.innerHTML = '♻️';

    new maplibregl.Marker({ element: elementoMobiliario })
      .setLngLat([lng, lat])
      .addTo(this.mapa);
  }

  // Cumplimiento estricto de la interfaz OnDestroy
  ngOnDestroy() {
    if (this.mapa) {
      this.mapa.remove();
    }
  }
}
