import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { IonContent, IonBadge } from '@ionic/angular/standalone';

import { AsistenteMapaComponent} from 'src/app/components/asistente-mapa/asistente-mapa.component';
import { ChatData } from 'src/app/core/interfaces/chat-data';
import { MapaService } from 'src/app/core/services/mapa.service';
import { MobiliarioService } from 'src/app/core/services/mobiliario.service';
import { CategoriaElemento } from 'src/app/core/models/mobiliario.model';
import { AsistenteEvent } from 'src/app/core/interfaces/asistente';
import { ChatbotComponent } from 'src/app/components/chatbot/chatbot.component';

@Component({
  selector: 'app-mapa',
  templateUrl: './mapa.page.html',
  styleUrls: ['./mapa.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonBadge,
    ChatbotComponent,
    AsistenteMapaComponent
]
})
export class MapaPage implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  @ViewChild(AsistenteMapaComponent) asistenteRef!: AsistenteMapaComponent;

  datosIniciales: ChatData | null = null;
  coordenadasMatch: { lat: number; lng: number } | null = null;

  asistenteVisible = false;
  categoriaActiva: CategoriaElemento | null = null;
  elementosColocados = 0;

  private ringsActivos: [number, number][][] | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private mapaService: MapaService,
    private mobiliarioService: MobiliarioService
  ) {

    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras.state?.['coordenadas']) {
      this.coordenadasMatch = navigation.extras.state['coordenadas'];
    }
  }

  ngOnInit() {
    // Recibe los rings del barrio una vez que el mapa los ha calculado
    this.mapaService.ringsBarrio$
      .pipe(takeUntil(this.destroy$))
      .subscribe(rings => {
        this.ringsActivos = rings;
        this.asistenteVisible = true; // abre el asistente cuando el mapa está listo
      });

    // Clic en el mapa: coloca el marcador si hay categoría activa
    this.mapaService.mapaClick$
      .pipe(takeUntil(this.destroy$))
  .subscribe(coords => {
    if (!this.datosIniciales || !this.categoriaActiva) return;

    this.mapaService.agregarMarcadorMobiliario(coords.lng, coords.lat, this.categoriaActiva);

    this.mobiliarioService.guardarElementoTemporal({
      tipo: this.categoriaActiva.tipo,
      barrio: this.datosIniciales.barrio,
      coordenadas: { lng: coords.lng, lat: coords.lat },
      fechaCreacion: new Date()
    });

    this.elementosColocados++;
    this.categoriaActiva = null;
    this.asistenteVisible = true; // ← reabre el panel en el paso 3
    this.asistenteRef?.confirmarColocacion();
      });
  }

  onChatComponentFinished(event: ChatData) {
    this.datosIniciales = event;
    setTimeout(() => { this.inicializarMapaEnBarrio(event.barrio); }, 100);
  }

  async inicializarMapaEnBarrio(barrioSeleccionado: string) {
    let centroCoordenadas: [number, number] = [-2.67268, 42.84695];
    let nivelZoom = 13.5;

    try {
      const geojsonBarrios = await firstValueFrom(this.mapaService.getBarrios());
      const barrioEncontrado = geojsonBarrios.features.find((f: any) =>
        f.attributes?.TEXTO?.toLowerCase() === barrioSeleccionado.toLowerCase()
      );
    } catch (error) {
      console.error('Error al leer el asset de barrios:', error);
    }

    if (this.coordenadasMatch) {
      centroCoordenadas = [this.coordenadasMatch.lng, this.coordenadasMatch.lat];
      nivelZoom = 16.5;
    }

    this.mapaService.construirMapa(
      this.mapContainer.nativeElement,
      centroCoordenadas,
      nivelZoom,
      barrioSeleccionado
    );

    if (this.coordenadasMatch) {
      this.mapaService.agregarMarcadorEstatico(this.coordenadasMatch.lng, this.coordenadasMatch.lat);
    }
  }


  onAsistenteEvento(evento: AsistenteEvent): void {
    if (evento.tipo === 'categoria-elegida' && evento.categoria) {
      this.categoriaActiva = evento.categoria;

      // Carga la capa de datos de la categoría
      if (this.ringsActivos && this.datosIniciales) {
        this.mapaService.cargarCapaParaCategoria(
          evento.categoria.tipo,
          this.datosIniciales.barrio,
          this.ringsActivos
        );
      }
    }

    if (evento.tipo === 'accion-final') {
      if (evento.accion === 'eliminar') {
        // TODO: implementar modo eliminación
        console.info('Modo eliminar — pendiente de implementar');
      }
      if (evento.accion === 'enviar') {
        // TODO: navegar a pantalla de resumen/envío
        console.info('Enviar datos — pendiente de implementar');
        this.asistenteVisible = false;
      }
    }
  }

  onAsistenteCerrado(): void {
    this.asistenteVisible = false;
    this.categoriaActiva = null;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.mapaService.destruirMapa();
  }
}