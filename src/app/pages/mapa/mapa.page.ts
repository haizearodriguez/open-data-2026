import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { IonContent, IonFab, IonFabButton, IonFabList, IonIcon, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { hammerOutline, closeOutline, leafOutline } from 'ionicons/icons';

import { ChatbotComponent } from "src/app/components/chatbot/chatbot.component";
import { ChatData } from 'src/app/core/interfaces/chat-data';
import { MapaService } from 'src/app/core/services/mapa.service';
import { MobiliarioService } from 'src/app/core/services/mobiliario.service';

@Component({
  selector: 'app-mapa',
  templateUrl: './mapa.page.html',
  styleUrls: ['./mapa.page.scss'],
  standalone: true,
  imports: [IonBadge, CommonModule, FormsModule, IonContent, IonFab, IonFabButton, IonFabList, IonIcon, ChatbotComponent]
})
export class MapaPage implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  
  datosIniciales: ChatData | null = null;
  coordenadasMatch: { lat: number; lng: number } | null = null;
  
  modoPlantar: boolean = false;
  tipoElementoSeleccionado: 'arbol' | 'banco' | 'farola' | 'papelera' = 'arbol';
  
  private clickMapaSub!: Subscription;

  constructor(
    private router: Router, 
    private mapaService: MapaService,
    private mobiliarioService: MobiliarioService
  ) {
    addIcons({ hammerOutline, closeOutline, leafOutline });
    
    // Captura de datos provenientes del buscador/sugerencias si el usuario saltó desde ahí
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state && navigation.extras.state['coordenadas']) {
      this.coordenadasMatch = navigation.extras.state['coordenadas'];
    }
  }

  ngOnInit() {
    // Escucha unificada y reactiva de los clics en el mapa gestionada por el servicio
    this.clickMapaSub = this.mapaService.mapaClick$.subscribe(coords => {
      if (!this.modoPlantar || !this.datosIniciales) return;
      
      // 1. El servicio dibuja de forma instantánea el emoji en el plano virtual
      this.mapaService.agregarMarcadorMobiliario(coords.lng, coords.lat, this.tipoElementoSeleccionado);
      
      // 2. El servicio de datos procesa y estructura el objeto para el borrador de la propuesta
      this.mobiliarioService.guardarElementoTemporal({
        tipo: this.tipoElementoSeleccionado,
        barrio: this.datosIniciales.barrio,
        coordenadas: { lng: coords.lng, lat: coords.lat },
        fechaCreacion: new Date()
      });
    });
  }

  /**
   * Recibe el evento final cuando el ciudadano rellena los datos mínimos del chatbot
   */
  onChatComponentFinished(event: ChatData) {
    this.datosIniciales = event;
    // Retraso técnico para asegurar que el contenedor #mapContainer se inyecte en el DOM por el *ngIf
    setTimeout(() => { this.inicializarMapaEnBarrio(event.barrio); }, 100);
  }

  /**
   * Carga la configuración geográfica inicial del barrio seleccionado y arranca la escena
   */
  async inicializarMapaEnBarrio(barrioSeleccionado: string) {
    let centroCoordenadas: [number, number] = [-2.67268, 42.84695]; 
    let nivelZoom = 13.5;

    try {
      const respuesta = await fetch('assets/data/barrios-vitoria.json');
      const geojsonBarrios = await respuesta.json();
      const barrioEncontrado = geojsonBarrios.features.find((f: any) => 
        f.properties?.nombre?.toLowerCase() === barrioSeleccionado.toLowerCase()
      );

      if (barrioEncontrado && barrioEncontrado.properties.centro) {
        centroCoordenadas = barrioEncontrado.properties.centro;
        nivelZoom = barrioEncontrado.properties.zoom || 15.5;
      }
    } catch (error) { 
      console.error('Error al leer el asset de barrios desde el componente:', error); 
    }

    // Prioridad absoluta a coordenadas si se viene de una navegación directa guiada
    if (this.coordenadasMatch) {
      centroCoordenadas = [this.coordenadasMatch.lng, this.coordenadasMatch.lat];
      nivelZoom = 16.5;
    }

    // Delegamos la creación del mapa e inyección de capas al MapaService
    this.mapaService.construirMapa(this.mapContainer.nativeElement, centroCoordenadas, nivelZoom, barrioSeleccionado);

    if (this.coordenadasMatch) {
      this.mapaService.agregarMarcadorEstatico(this.coordenadasMatch.lng, this.coordenadasMatch.lat);
    }
  }

  conmutarModoPlantar() { 
    this.modoPlantar = !this.modoPlantar; 
  }

  seleccionarHerramienta(tipo: 'arbol' | 'banco' | 'farola' | 'papelera') { 
    this.modoPlantar = true; 
    this.tipoElementoSeleccionado = tipo; 
  }

  ngOnDestroy() {
    if (this.clickMapaSub) this.clickMapaSub.unsubscribe();
    this.mapaService.destruirMapa();
  }
}