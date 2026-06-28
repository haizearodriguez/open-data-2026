import { Component, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { IonContent, IonBadge, MenuController } from '@ionic/angular/standalone';

import { AsistenteMapaComponent } from 'src/app/components/asistente-mapa/asistente-mapa.component';
import { SelectorRapidoComponent } from 'src/app/components/selector-rapido/selector-rapido.component';
import { ChatData } from 'src/app/core/interfaces/chat-data';
import { MapaService } from 'src/app/core/services/mapa.service';
import { MobiliarioService } from 'src/app/core/services/mobiliario.service';
import { CategoriaElemento } from 'src/app/core/models/mobiliario.model';

@Component({
  selector: 'app-mapa',
  templateUrl: './mapa.page.html',
  styleUrls: ['./mapa.page.scss'],
  standalone: true,
  imports: [
    CommonModule, IonContent, IonBadge,
    AsistenteMapaComponent, SelectorRapidoComponent
  ]
})
export class MapaPage implements OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  @ViewChild(AsistenteMapaComponent) asistenteRef!: AsistenteMapaComponent;

  datosIniciales: ChatData | null = null;
  coordenadasMatch: { lat: number; lng: number } | null = null;

  asistenteVisible = false;
  selectorRapidoVisible = false;
  modoEliminarActivo = false;
  categoriaActiva: CategoriaElemento | null = null;
  elementosColocados = 0;

  private ringsActivos: [number, number][][] | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private mapaService: MapaService,
    private mobiliarioService: MobiliarioService,
    private menuCtrl: MenuController
  ) {}

  async ionViewDidEnter(): Promise<void> {
    const state = history.state;

    // Resetea todo el estado
    this.datosIniciales = null;
    this.categoriaActiva = null;
    this.coordenadasMatch = null;
    this.elementosColocados = 0;
    this.asistenteVisible = false;
    this.selectorRapidoVisible = false;
    this.modoEliminarActivo = false;
    this.ringsActivos = null;

    if (state?.barrio) {
      this.datosIniciales = { barrio: state.barrio, modo: state.modo ?? 'manual' };
      if (state.categoria) this.categoriaActiva = state.categoria;
    }

    if (state?.coordenadas) this.coordenadasMatch = state.coordenadas;
    if (!this.datosIniciales || !this.mapContainer) return;

    // Cancela suscripciones anteriores
    this.destroy$.next();
    this.destroy$ = new Subject<void>();

    // 1. PRIMERO construir el mapa — esto recrea los Subjects internos
    await this.inicializarMapaEnBarrio(this.datosIniciales.barrio);

    // 2. DESPUÉS suscribirse a los Subjects nuevos
    this.mapaService.ringsBarrio$
      .pipe(takeUntil(this.destroy$))
      .subscribe(rings => {
        this.ringsActivos = rings;
        this.asistenteVisible = true;
        if (this.categoriaActiva && this.datosIniciales) {
          this.mapaService.cargarCapaParaCategoria(
            this.categoriaActiva.tipo,
            this.datosIniciales.barrio,
            rings
          );
        }
      });

    this.mapaService.mapaClick$
      .pipe(takeUntil(this.destroy$))
      .subscribe(coords => {
        console.log('SUSCRIPCION CLIC', {
          categoriaActiva: this.categoriaActiva?.tipo,
          datosIniciales: this.datosIniciales?.barrio
        });
        if (!this.datosIniciales || !this.categoriaActiva || this.modoEliminarActivo) return;

        const marcadorId = this.mapaService.agregarMarcadorMobiliario(
          coords.lng, coords.lat, this.categoriaActiva,
          (id) => this.onMarcadorEliminado(id)
        );

        this.mobiliarioService.guardarElementoTemporal({
          id: marcadorId,
          tipo: this.categoriaActiva.tipo,
          barrio: this.datosIniciales.barrio,
          coordenadas: { lng: coords.lng, lat: coords.lat },
          fechaCreacion: new Date()
        });

        this.elementosColocados++;
        this.categoriaActiva = null;
        this.asistenteVisible = false;
      });
  }

  async inicializarMapaEnBarrio(barrioSeleccionado: string): Promise<void> {
    let centroCoordenadas: [number, number] = [-2.67268, 42.84695];
    let nivelZoom = 13.5;

    if (this.coordenadasMatch) {
      centroCoordenadas = [this.coordenadasMatch.lng, this.coordenadasMatch.lat];
      nivelZoom = 16.5;
    }

    // construirMapa recrea los Subjects — suscribirse DESPUÉS de esta llamada
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

  onAsistenteCerrado(): void {
    this.asistenteVisible = false;
    // NO borra categoriaActiva — el usuario cierra el panel para tocar el mapa
  }

  onCategoriaRapidaElegida(cat: CategoriaElemento): void {
    this.categoriaActiva = cat;
    this.selectorRapidoVisible = false;
    this.asistenteVisible = true;
    this.asistenteRef?.reiniciarParaNuevo();

    if (this.ringsActivos && this.datosIniciales) {
      this.mapaService.cargarCapaParaCategoria(cat.tipo, this.datosIniciales.barrio, this.ringsActivos);
    }
  }

  onEliminar(): void {
    this.modoEliminarActivo = true;
    this.mapaService.activarModoEliminar();
  }

  onMarcadorEliminado(id: string): void {
    this.mapaService.eliminarMarcadorPorId(id);
    this.mobiliarioService.eliminarElementoPorId(id);
    this.elementosColocados = this.mapaService.getTotalMarcadores();
    this.modoEliminarActivo = false;
    this.mapaService.desactivarModoEliminar();
  }

  onEnviar(): void {
    this.modoEliminarActivo = false;
    this.mapaService.desactivarModoEliminar();
    this.router.navigate(['/resumen']);
  }

  abrirMenu(): void {
    this.menuCtrl.open();
  }

  ionViewWillLeave(): void {
    this.destroy$.next();
    this.mapaService.destruirMapa();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.mapaService.destruirMapa();
  }
}