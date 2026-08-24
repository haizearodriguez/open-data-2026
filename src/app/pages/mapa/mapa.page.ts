import {
  Component,
  OnDestroy,
  ElementRef,
  ViewChild
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton
} from '@ionic/angular/standalone';

import {
  IdiomaSelectorComponent
} from 'src/app/components/idioma-selector/idioma-selector.component';

import {
  AsistenteMapaComponent
} from 'src/app/components/asistente-mapa/asistente-mapa.component';

import {
  SelectorRapidoComponent
} from 'src/app/components/selector-rapido/selector-rapido.component';

import {
  ChatData
} from 'src/app/core/interfaces/chat-data';

import {
  MapaService
} from 'src/app/core/services/mapa.service';

import {
  MobiliarioService
} from 'src/app/core/services/mobiliario.service';

import {
  CategoriaElemento,
  CATEGORIAS_ELEMENTOS
} from 'src/app/core/models/mobiliario.model';


@Component({
  selector: 'app-mapa',
  templateUrl: './mapa.page.html',
  styleUrls: ['./mapa.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IdiomaSelectorComponent,
    AsistenteMapaComponent,
    SelectorRapidoComponent
  ]
})
export class MapaPage implements OnDestroy {

  @ViewChild('mapContainer', { static: false })
  mapContainer!: ElementRef;

  @ViewChild(AsistenteMapaComponent)
  asistenteRef!: AsistenteMapaComponent;

  datosIniciales: ChatData | null = null;

  coordenadasMatch:
    { lat: number; lng: number } | null = null;

  asistenteVisible = false;

  selectorRapidoVisible = false;

  modoEliminarActivo = false;

  categoriaActiva:
    CategoriaElemento | null = null;

  elementosColocados = 0;

  /**
   * Solo pertenece a esta instancia de la página.
   * Si Ionic conserva la página al volver desde resumen,
   * evitamos reconstruirla.
   */
  private mapaInicializado = false;

  private ringsActivos:
    [number, number][][] | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private mapaService: MapaService,
    private mobiliarioService: MobiliarioService
  ) {}

  async ionViewDidEnter(): Promise<void> {

    /*
     * CASO 1:
     * La misma MapaPage sigue viva.
     *
     * No tocamos absolutamente nada del mapa.
     */
    if (this.mapaInicializado) {

      this.elementosColocados =
        this.mobiliarioService
          .obtenerPropuestaActual()
          .length;

      this.asistenteVisible = false;
      this.selectorRapidoVisible = false;
      this.modoEliminarActivo = false;

      this.mapaService.desactivarModoEliminar();

      return;
    }

    /*
     * CASO 2:
     * La página fue recreada al volver desde "Tu propuesta".
     *
     * No podemos confiar en history.state, porque ese estado
     * todavía contiene la categoría original de Chat.
     *
     * La fuente de verdad es el estado persistente de MapaService
     * + la propuesta de MobiliarioService.
     */
    const restaurarPropuesta =
      this.mapaService.estaPropuestaEnEdicion();

    const propuesta =
      this.mobiliarioService
        .obtenerPropuestaActual();

    const state =
      history.state;

    this.datosIniciales = null;
    this.categoriaActiva = null;
    this.coordenadasMatch = null;
    this.elementosColocados = propuesta.length;
    this.asistenteVisible = false;
    this.selectorRapidoVisible = false;
    this.modoEliminarActivo = false;
    this.ringsActivos = null;

    /*
     * Al volver desde resumen usamos el barrio guardado
     * en la propia propuesta y NO la categoría de Chat.
     */
    if (
      restaurarPropuesta &&
      propuesta.length > 0
    ) {

      this.datosIniciales = {
        barrio: propuesta[0].barrio,
        modo: 'manual'
      };

    } else if (state?.barrio) {

      /*
       * FLUJO ORIGINAL:
       *
       * Chat → Mapa
       */
      this.datosIniciales = {
        barrio: state.barrio,
        modo: state.modo ?? 'manual'
      };

      if (state.categoria) {
        this.categoriaActiva =
          state.categoria;
      }

      if (state.coordenadas) {
        this.coordenadasMatch =
          state.coordenadas;
      }
    }

    if (
      !this.datosIniciales ||
      !this.mapContainer
    ) {
      return;
    }

    /*
     * Las suscripciones deben existir ANTES de construir el mapa.
     * construirMapa() ahora devuelve una Promise y espera al load.
     */
    this.destroy$.next();
    this.destroy$ = new Subject<void>();

    this.suscribirEventosMapa();

    await this.inicializarMapaEnBarrio(
      this.datosIniciales.barrio
    );

    this.mapaInicializado = true;

    /*
     * Si la página fue recreada durante una propuesta,
     * reconstruimos SOLO la representación visual.
     *
     * NO añadimos nada al array.
     */
    if (
      restaurarPropuesta &&
      propuesta.length > 0
    ) {
      this.restaurarMarcadores(propuesta);

      this.categoriaActiva = null;
      this.asistenteVisible = false;
      this.selectorRapidoVisible = false;
    }
  }

  private suscribirEventosMapa(): void {

    this.mapaService.ringsBarrio$
      .pipe(takeUntil(this.destroy$))
      .subscribe(rings => {

        this.ringsActivos = rings;

        /*
         * En una restauración no existe categoría activa.
         * En Chat → Mapa sí puede existir.
         */
        this.asistenteVisible =
          !!this.categoriaActiva;

        if (
          this.categoriaActiva &&
          this.datosIniciales
        ) {

          this.mapaService
            .cargarCapaParaCategoria(
              this.categoriaActiva.tipo,
              this.datosIniciales.barrio,
              rings
            );
        }
      });


    this.mapaService.mapaClick$
      .pipe(takeUntil(this.destroy$))
      .subscribe(coords => {

        if (
          !this.datosIniciales ||
          !this.categoriaActiva ||
          this.modoEliminarActivo
        ) {
          return;
        }

        const categoria =
          this.categoriaActiva;

        const marcadorId =
          this.mapaService
            .agregarMarcadorMobiliario(
              coords.lng,
              coords.lat,
              categoria,
              id => this.onMarcadorEliminado(id)
            );

        /*
         * AQUÍ y solamente aquí se añade
         * un nuevo elemento a la propuesta.
         */
        this.mobiliarioService
          .guardarElementoTemporal({
            id: marcadorId,
            tipo: categoria.tipo,
            barrio: this.datosIniciales.barrio,
            coordenadas: {
              lng: coords.lng,
              lat: coords.lat
            },
            fechaCreacion: new Date()
          });

        this.elementosColocados =
          this.mobiliarioService
            .obtenerPropuestaActual()
            .length;

        this.categoriaActiva = null;
        this.asistenteVisible = false;
      });
  }

  private restaurarMarcadores(
    elementos: ReturnType<
      MobiliarioService['obtenerPropuestaActual']
    >
  ): void {

    for (const elemento of elementos) {

      const categoria =
        CATEGORIAS_ELEMENTOS.find(
          c => c.tipo === elemento.tipo
        );

      if (!categoria) {
        continue;
      }

      this.mapaService
        .agregarMarcadorMobiliario(
          elemento.coordenadas.lng,
          elemento.coordenadas.lat,
          categoria,
          id => this.onMarcadorEliminado(id),
          elemento.id
        );
    }

    this.elementosColocados =
      elementos.length;
  }

  async inicializarMapaEnBarrio(
    barrioSeleccionado: string
  ): Promise<void> {

    let centroCoordenadas:
      [number, number] =
      [-2.67268, 42.84695];

    let nivelZoom = 13.5;

    if (this.coordenadasMatch) {

      centroCoordenadas = [
        this.coordenadasMatch.lng,
        this.coordenadasMatch.lat
      ];

      nivelZoom = 16.5;
    }

    /*
     * Ahora SÍ esperamos a que MapLibre haya terminado
     * su carga y a que exista el mapa.
     */
    await this.mapaService
      .construirMapa(
        this.mapContainer.nativeElement,
        centroCoordenadas,
        nivelZoom,
        barrioSeleccionado
      );

    if (this.coordenadasMatch) {

      this.mapaService
        .agregarMarcadorEstatico(
          this.coordenadasMatch.lng,
          this.coordenadasMatch.lat
        );
    }
  }

  onAsistenteCerrado(): void {
    this.asistenteVisible = false;
  }

  onCategoriaRapidaElegida(
    cat: CategoriaElemento
  ): void {

    this.categoriaActiva = cat;
    this.selectorRapidoVisible = false;
    this.asistenteVisible = true;

    this.asistenteRef
      ?.reiniciarParaNuevo();

    if (
      this.ringsActivos &&
      this.datosIniciales
    ) {

      this.mapaService
        .cargarCapaParaCategoria(
          cat.tipo,
          this.datosIniciales.barrio,
          this.ringsActivos
        );
    }
  }

  onEliminar(): void {

    this.modoEliminarActivo = true;

    this.mapaService
      .activarModoEliminar();
  }

  onMarcadorEliminado(id: string): void {

    this.mapaService
      .eliminarMarcadorPorId(id);

    this.mobiliarioService
      .eliminarElementoPorId(id);

    this.elementosColocados =
      this.mobiliarioService
        .obtenerPropuestaActual()
        .length;

    this.modoEliminarActivo = false;

    this.mapaService
      .desactivarModoEliminar();
  }

  onEnviar(): void {

    if (
      this.mobiliarioService
        .obtenerPropuestaActual()
        .length === 0
    ) {
      return;
    }

    this.modoEliminarActivo = false;

    this.mapaService
      .desactivarModoEliminar();

    /*
     * Marcamos la propuesta como abierta.
     * Si Ionic recrea MapaPage al volver,
     * podremos reconocer que venimos de resumen
     * y no volver a aplicar la categoría de Chat.
     */
    this.mapaService
      .marcarPropuestaEnEdicion();

    this.router.navigate([
      '/resumen'
    ]);
  }

  nuevaPropuesta(): void {

    /*
     * Este es uno de los DOS únicos lugares
     * donde destruimos definitivamente el mapa:
     *
     * Mapa → Chat
     */
    this.destroy$.next();

    this.mobiliarioService
      .limpiarPropuesta();

    this.elementosColocados = 0;
    this.categoriaActiva = null;
    this.asistenteVisible = false;
    this.selectorRapidoVisible = false;
    this.modoEliminarActivo = false;

    this.mapaService
      .desactivarModoEliminar();

    this.mapaService
      .finalizarPropuesta();

    this.mapaService
      .destruirMapa();

    this.mapaInicializado = false;

    this.router.navigate(
      ['/chat'],
      {
        state: {
          nuevaPropuesta: true
        }
      }
    );
  }

  /*
   * Salir de MapaPage NO destruye el mapa.
   *
   * En particular:
   * Mapa → Tu propuesta
   */
  ionViewWillLeave(): void {
    // Intencionadamente vacío.
  }

  /*
   * La página puede ser destruida por el router.
   * NO destruimos el MapaService aquí.
   *
   * La destrucción definitiva es explícita:
   * - volver al Chat
   * - envío correcto al Ayuntamiento
   */
  ngOnDestroy(): void {

    this.destroy$.next();
    this.destroy$.complete();

  }
}
