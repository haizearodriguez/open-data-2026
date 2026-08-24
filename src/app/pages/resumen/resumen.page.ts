import {
  Component,
  OnInit
} from '@angular/core';

import {
  CommonModule
} from '@angular/common';

import {
  FormsModule
} from '@angular/forms';

import {
  Router
} from '@angular/router';

import {
  NavController
} from '@ionic/angular';

import {
  IonContent,
  IonSpinner
} from '@ionic/angular/standalone';

import {
  MobiliarioService
} from 'src/app/core/services/mobiliario.service';

import {
  MapaService
} from 'src/app/core/services/mapa.service';

import {
  FunctionsError,
  FunctionsService
} from 'src/app/core/services/functions.service';

import {
  ElementoMobiliario,
  CATEGORIAS_ELEMENTOS,
  CategoriaElemento
} from 'src/app/core/models/mobiliario.model';


@Component({
  selector: 'app-resumen',

  templateUrl:
    './resumen.page.html',

  styleUrls:
    ['./resumen.page.scss'],

  standalone: true,

  imports: [

    CommonModule,

    FormsModule,

    IonContent,

    IonSpinner

  ]
})
export class ResumenPage
  implements OnInit {


  elementos:
    ElementoMobiliario[] = [];


  barrio =
    '';


  desdeFoto =
    false;


  nombre =
    '';


  primerApellido =
    '';


  segundoApellido =
    '';


  dni =
    '';


  emailCiudadano =
    '';


  titulo =
    '';


  descripcion =
    '';


  enviando =
    false;


  generando =
    false;


  error =
    '';


  errorIa =
    '';


  /**
   * Errores concretos devueltos por backend.
   */
  erroresValidacion:
    string[] = [];


  referencia:
    string | null = null;


  constructor(

    private mobiliarioService:
      MobiliarioService,

    private functions:
      FunctionsService,

    private router:
      Router,

    private navController:
      NavController,

    private mapaService:
      MapaService

  ) {}

  ionViewWillEnter(): void {

    const state =
      history.state;


    /*
    * Si venimos desde Mapa → Enviar,
    * estamos entrando en el resumen de
    * una propuesta nueva.
    */
    if (
      state?.nuevaRevision === true
    ) {



      this.reiniciarFormulario();

      /*
      * Consumimos el estado para que no vuelva
      * a ejecutarse accidentalmente.
      */
      history.replaceState(
        {},
        '',
        window.location.href
      );

      /*
      * Cargamos los elementos actuales
      * de MobiliarioService.
      */
      this.cargarPropuesta();
    }
  }


  // ==================================================
  // INICIO
  // ==================================================

  ngOnInit(): void {

    const state =
      history.state;


    this.desdeFoto =
      state?.desdeFoto ?? false;


    /*
     * Flujo de fotografía.
     *
     * No modificamos el flujo del mapa.
     */
    if (
      this.desdeFoto
    ) {

      const categoria:
        CategoriaElemento =
        state.categoria;


      const coordenadas =
        state.coordenadas ?? {

          lat:
            42.84695,

          lng:
            -2.67268

        };


      const id =
        `foto-${Date.now()}`;


      if (
        categoria
      ) {

        this.mobiliarioService
          .guardarElementoTemporal({

            id,

            tipo:
              categoria.tipo,

            barrio:
              state.barrio ?? '',

            coordenadas,

            fechaCreacion:
              new Date()

          });

      }


      this.titulo =
        state.titulo ?? '';


      this.descripcion =
        state.descripcion ?? '';

    }


    this.cargarPropuesta();

  }


  /**
   * Recarga la propuesta actual.
   */
  private cargarPropuesta(): void {

    this.elementos =
      this.mobiliarioService
        .obtenerPropuestaActual();


    this.barrio =
      this.elementos[0]?.barrio ?? '';



    /*
    * Solo generamos un título automático
    * si todavía no existe.
    */
    if (
      !this.titulo &&
      this.elementos.length > 0
    ) {

      const tipos = [

        ...new Set(

          this.elementos.map(
            e =>
              this.getEtiqueta(e.tipo)
          )

        )

      ];

      this.titulo =
        `Solicitud de mejora en ${this.barrio}: ${tipos.join(', ')}`;
    }
  }


  // ==================================================
  // ELEMENTOS
  // ==================================================

  getEmoji(
    tipo: string
  ): string {

    return (

      CATEGORIAS_ELEMENTOS.find(

        c =>
          c.tipo === tipo

      )?.emoji

      ??

      '📍'

    );

  }

  


  getEtiqueta(
    tipo: string
  ): string {

    return (

      CATEGORIAS_ELEMENTOS.find(

        c =>
          c.tipo === tipo

      )?.etiqueta

      ??

      tipo

    );

  }


  // ==================================================
  // VALIDACIÓN
  // ==================================================

  formularioValido():
    boolean {

    return !!(

      this.nombre.trim() &&

      this.primerApellido.trim() &&

      this.dni.trim() &&

      this.emailCiudadano.trim() &&

      this.titulo.trim() &&

      this.descripcion.trim()

    );

  }


  obtenerErroresFormulario():
    string[] {

    const errores:
      string[] = [];


    const nombre =
      this.nombre.trim();


    const primerApellido =
      this.primerApellido.trim();


    const segundoApellido =
      this.segundoApellido.trim();


    const dni =
      this.dni
        .trim()
        .toUpperCase();


    const email =
      this.emailCiudadano.trim();


    const titulo =
      this.titulo.trim();


    const descripcion =
      this.descripcion.trim();


    // -----------------------------------------------
    // Nombre
    // -----------------------------------------------

    if (
      nombre.length < 2 ||
      nombre.length > 100
    ) {

      errores.push(
        'El nombre debe tener entre 2 y 100 caracteres.'
      );

    }


    // -----------------------------------------------
    // Primer apellido
    // -----------------------------------------------

    if (
      primerApellido.length < 2 ||
      primerApellido.length > 100
    ) {

      errores.push(
        'El primer apellido debe tener entre 2 y 100 caracteres.'
      );

    }


    // -----------------------------------------------
    // Segundo apellido
    // -----------------------------------------------

    if (
      segundoApellido &&

      (
        segundoApellido.length < 2 ||

        segundoApellido.length > 100

      )
    ) {

      errores.push(
        'El segundo apellido debe tener entre 2 y 100 caracteres.'
      );

    }


    // -----------------------------------------------
    // DNI / NIE
    // -----------------------------------------------

    if (
      !/^[0-9XYZ][0-9]{7}[A-Z]$/
        .test(dni)
    ) {

      errores.push(
        'El DNI/NIE no tiene un formato válido.'
      );

    }


    // -----------------------------------------------
    // Email
    // -----------------------------------------------

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email)
    ) {

      errores.push(
        'El email no tiene un formato válido.'
      );

    }


    // -----------------------------------------------
    // Título
    // -----------------------------------------------

    if (
      titulo.length < 5 ||
      titulo.length > 200
    ) {

      errores.push(
        'El título debe tener entre 5 y 200 caracteres.'
      );

    }


    // -----------------------------------------------
    // Descripción
    // -----------------------------------------------

    if (
      descripcion.length < 10 ||
      descripcion.length > 5000
    ) {

      errores.push(
        'La descripción debe tener entre 10 y 5000 caracteres.'
      );

    }


    // -----------------------------------------------
    // Elementos
    // -----------------------------------------------

    if (
      this.elementos.length < 1
    ) {

      errores.push(
        'Debes seleccionar al menos un elemento.'
      );

    }


    return errores;

  }


  // ==================================================
  // IA
  // ==================================================

  async generarConIa():
    Promise<void> {

    this.generando =
      true;


    this.errorIa =
      '';


    try {

      const elementosPayload =
        this.elementos.map(e => ({

          etiqueta:
            this.getEtiqueta(e.tipo),

          emoji:
            this.getEmoji(e.tipo),

          coordenadas:
            e.coordenadas

        }));


      const json =
        await this.functions.post<{

          ok:
            boolean;

          titulo?:
            string;

          descripcion?:
            string;

        }>(

          'generar-texto',

          {

            barrio:
              this.barrio,

            elementos:
              elementosPayload

          }

        );


      if (
        typeof json.titulo !==
          'string' ||

        typeof json.descripcion !==
          'string'
      ) {

        throw new Error(
          'La IA no devolvió un título y una descripción válidos.'
        );

      }


      this.titulo =
        json.titulo.trim();


      this.descripcion =
        json.descripcion.trim();


    } catch (
      e: unknown
    ) {

      this.errorIa =

        e instanceof Error

          ? e.message

          : 'No se pudo generar el texto. Inténtalo de nuevo.';


    } finally {

      this.generando =
        false;

    }

  }


  // ==================================================
  // ENVÍO DEFINITIVO
  // ==================================================

  async enviar():
    Promise<void> {

    /*
     * Limpiar errores anteriores.
     */
    this.error =
      '';


    this.erroresValidacion =
      [];


    // -----------------------------------------------
    // Validación
    // -----------------------------------------------

    const erroresFormulario =
      this.obtenerErroresFormulario();


    if (
      erroresFormulario.length > 0
    ) {

      this.error =
        'Revisa los datos introducidos.';


      this.erroresValidacion =
        erroresFormulario;


      return;

    }


    this.enviando =
      true;


    // -----------------------------------------------
    // Payload
    // -----------------------------------------------

    const elementosConEmoji =
      this.elementos.map(e => ({

        tipo:
          e.tipo,

        etiqueta:
          this.getEtiqueta(e.tipo),

        emoji:
          this.getEmoji(e.tipo),

        barrio:
          e.barrio,

        coordenadas:
          e.coordenadas

      }));


    try {

      const json =
        await this.functions.post<{

          ok:
            boolean;

          referencia?:
            string;

          error?:
            string;

          detalles?:
            string[];

        }>(

          'enviar-propuesta',

          {

            nombre:
              this.nombre.trim(),

            primerApellido:
              this.primerApellido.trim(),

            segundoApellido:
              this.segundoApellido
                .trim() ||

              undefined,

            dni:
              this.dni
                .trim()
                .toUpperCase(),

            emailCiudadano:
              this.emailCiudadano
                .trim()
                .toLowerCase(),

            barrio:
              this.barrio,

            elementos:
              elementosConEmoji,

            titulo:
              this.titulo.trim(),

            detalle:
              this.descripcion.trim()

          }

        );


      // ---------------------------------------------
      // ENVÍO CORRECTO
      // ---------------------------------------------

      this.referencia =
        json.referencia ?? null;


      /*
       * Aquí sí terminamos la propuesta.
       */
      this.mobiliarioService
        .limpiarPropuesta();

      /*
       * La propuesta ya terminó.
       * A partir de aquí el mapa puede destruirse.
       */
      this.mapaService
        .finalizarPropuesta();


      /*
       * Y SOLO aquí destruimos el mapa.
       *
       * Esta es la segunda situación autorizada
       * para destruirlo.
       */
      this.mapaService
        .destruirMapa();


    } catch (
      e: unknown
    ) {

      /*
       * Si falla el envío NO destruimos
       * el mapa ni limpiamos la propuesta.
       */
      if (
        e instanceof FunctionsError &&

        Array.isArray(
          e.payload['detalles']
        )
      ) {

        this.erroresValidacion =
          e.payload['detalles']
            .filter(

              (
                item
              ): item is string =>

                typeof item ===
                'string'

            );

      }


      this.error =

        e instanceof Error

          ? e.message

          : 'No se pudo enviar la propuesta.';


    } finally {

      this.enviando =
        false;

    }

  }


  // ==================================================
  // VOLVER AL MAPA
  // ==================================================

  /**
   * Vuelve a la instancia de MapaPage que ya existe.
   *
   * NO hacemos:
   *
   * router.navigate(['/mapa'])
   *
   * porque eso vuelve a construir el mapa.
   */
  volverAlMapa(): void {

    this.navController
      .back();

  }


  // ==================================================
  // VOLVER AL CHAT
  // ==================================================

  /**
   * Se ejecuta después de que la propuesta
   * ya haya sido enviada correctamente.
   *
   * El mapa ya fue destruido en enviar().
   */
  volverAlChat(): void {

    this.router.navigate(

      ['/chat'],

      {
        state: {
          nuevaPropuesta: true
        }
      }

    );

  }

  private reiniciarFormulario(): void {

  this.referencia =
    null;

  this.error =
    '';

  this.errorIa =
    '';

  this.erroresValidacion =
    [];

  this.enviando =
    false;

  this.generando =
    false;

  this.titulo =
    '';

  this.descripcion =
    '';

  this.desdeFoto =
    false;

  this.nombre =
    '';

  this.primerApellido =
    '';

  this.segundoApellido =
    '';

  this.dni =
    '';

  this.emailCiudadano =
    '';

  this.elementos =
    [];

  this.barrio =
    '';
}

}