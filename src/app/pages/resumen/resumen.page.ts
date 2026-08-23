import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonSpinner
} from '@ionic/angular/standalone';

import { MobiliarioService } from 'src/app/core/services/mobiliario.service';
import { SupabaseService } from 'src/app/core/services/supabase.service';

import {
  ElementoMobiliario,
  CATEGORIAS_ELEMENTOS,
  CategoriaElemento
} from 'src/app/core/models/mobiliario.model';

@Component({
  selector: 'app-resumen',
  templateUrl: './resumen.page.html',
  styleUrls: ['./resumen.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonSpinner
  ]
})
export class ResumenPage implements OnInit {

  elementos: ElementoMobiliario[] = [];

  barrio = '';
  desdeFoto = false;

  nombre = '';
  primerApellido = '';
  segundoApellido = '';
  dni = '';
  emailCiudadano = '';

  titulo = '';
  descripcion = '';

  enviando = false;
  generando = false;

  error = '';
  errorIa = '';

  /**
   * Errores concretos devueltos por el backend.
   *
   * Ejemplo:
   * [
   *   'El DNI/NIE no tiene un formato válido.',
   *   'El email no tiene un formato válido.'
   * ]
   */
  erroresValidacion: string[] = [];

  referencia: string | null = null;

  constructor(
    private mobiliarioService: MobiliarioService,
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  ngOnInit() {
    const state = history.state;

    this.desdeFoto =
      state?.desdeFoto ?? false;

    if (this.desdeFoto) {

      // Viene de la página de foto.
      // Los datos ya vienen pre-rellenados.

      const categoria: CategoriaElemento =
        state.categoria;

      const coordenadas =
        state.coordenadas ?? {
          lat: 42.84695,
          lng: -2.67268
        };

      const id =
        `foto-${Date.now()}`;

      this.mobiliarioService
        .guardarElementoTemporal({
          id,
          tipo: categoria.tipo,
          barrio: 'Vitoria-Gasteiz',
          coordenadas,
          fechaCreacion: new Date()
        });

      this.titulo =
        state.titulo ?? '';

      this.descripcion =
        state.descripcion ?? '';
    }

    this.elementos =
      this.mobiliarioService
        .obtenerPropuestaActual();

    this.barrio =
      this.elementos[0]?.barrio ?? '';

    // Si no viene un título generado previamente,
    // creamos uno automáticamente.

    if (!this.titulo) {

      const tipos = [
        ...new Set(
          this.elementos.map(
            e => this.getEtiqueta(e.tipo)
          )
        )
      ];

      this.titulo =
        `Solicitud de mejora en ${this.barrio}: ${tipos.join(', ')}`;
    }
  }

  // --------------------------------------------------
  // ELEMENTOS
  // --------------------------------------------------

  getEmoji(tipo: string): string {
    return (
      CATEGORIAS_ELEMENTOS.find(
        c => c.tipo === tipo
      )?.emoji ?? '📍'
    );
  }

  getEtiqueta(tipo: string): string {
    return (
      CATEGORIAS_ELEMENTOS.find(
        c => c.tipo === tipo
      )?.etiqueta ?? tipo
    );
  }

  // --------------------------------------------------
  // VALIDACIÓN FRONTEND
  // --------------------------------------------------

  formularioValido(): boolean {

    return !!(
      this.nombre.trim() &&
      this.primerApellido.trim() &&
      this.dni.trim() &&
      this.emailCiudadano.trim() &&
      this.titulo.trim() &&
      this.descripcion.trim()
    );
  }

  /**
   * Validación básica del formulario para mejorar
   * la experiencia de usuario.
   *
   * La validación definitiva siempre se hace
   * nuevamente en el backend.
   */
  obtenerErroresFormulario(): string[] {

    const errores: string[] = [];

    const nombre =
      this.nombre.trim();

    const primerApellido =
      this.primerApellido.trim();

    const segundoApellido =
      this.segundoApellido.trim();

    const dni =
      this.dni.trim().toUpperCase();

    const email =
      this.emailCiudadano.trim();

    const titulo =
      this.titulo.trim();

    const descripcion =
      this.descripcion.trim();

    // Nombre

    if (
      nombre.length < 2 ||
      nombre.length > 100
    ) {
      errores.push(
        'El nombre debe tener entre 2 y 100 caracteres.'
      );
    }

    // Primer apellido

    if (
      primerApellido.length < 2 ||
      primerApellido.length > 100
    ) {
      errores.push(
        'El primer apellido debe tener entre 2 y 100 caracteres.'
      );
    }

    // Segundo apellido

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

    // DNI / NIE

    if (
      !/^[0-9XYZ][0-9]{7}[A-Z]$/.test(dni)
    ) {
      errores.push(
        'El DNI/NIE no tiene un formato válido.'
      );
    }

    // Email

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      errores.push(
        'El email no tiene un formato válido.'
      );
    }

    // Título

    if (
      titulo.length < 5 ||
      titulo.length > 200
    ) {
      errores.push(
        'El título debe tener entre 5 y 200 caracteres.'
      );
    }

    // Descripción

    if (
      descripcion.length < 10 ||
      descripcion.length > 5000
    ) {
      errores.push(
        'La descripción debe tener entre 10 y 5000 caracteres.'
      );
    }

    // Elementos

    if (
      this.elementos.length < 1
    ) {
      errores.push(
        'Debes seleccionar al menos un elemento.'
      );
    }

    return errores;
  }

  // --------------------------------------------------
  // IA
  // --------------------------------------------------

  async generarConIa(): Promise<void> {
    this.generando = true;
    this.errorIa = '';

    try {
      const url =
        `${this.supabaseService.getFunctionUrl()}/generar-texto`;

      const elementosPayload = this.elementos.map(e => ({
        etiqueta: this.getEtiqueta(e.tipo),
        emoji: this.getEmoji(e.tipo),
        coordenadas: e.coordenadas,
      }));

      const res = await fetch(url, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',

          'apikey':
            this.supabaseService.getAnonKey(),

          'Authorization':
            `Bearer ${this.supabaseService.getAnonKey()}`,
        },

        body: JSON.stringify({
          barrio: this.barrio,
          elementos: elementosPayload,
        }),
      });

      // ----------------------------------------------
      // Intentamos leer JSON
      // ----------------------------------------------

      let json: any;

      try {
        json = await res.json();
      } catch {
        throw new Error(
          `El servidor devolvió una respuesta no válida. HTTP ${res.status}.`
        );
      }

      // ----------------------------------------------
      // Error de la Edge Function / Groq
      // ----------------------------------------------

      if (!res.ok || !json?.ok) {

        console.error(
          'Error completo de generar-texto:',
          json
        );

        const errores: string[] = [];

        if (json?.error) {
          errores.push(
            `Error: ${json.error}`
          );
        }

        if (json?.codigo) {
          errores.push(
            `Código: ${json.codigo}`
          );
        }

        if (json?.detalle) {
          errores.push(
            `Detalle: ${json.detalle}`
          );
        }

        if (json?.detalles) {
          errores.push(
            `Detalles: ${
              Array.isArray(json.detalles)
                ? json.detalles.join(', ')
                : json.detalles
            }`
          );
        }

        throw new Error(
          errores.length > 0
            ? errores.join(' | ')
            : 'No se pudo generar el texto.'
        );
      }

      // ----------------------------------------------
      // Comprobar respuesta de la IA
      // ----------------------------------------------

      if (
        typeof json.titulo !== 'string' ||
        typeof json.descripcion !== 'string'
      ) {

        console.error(
          'Respuesta IA inesperada:',
          json
        );

        throw new Error(
          'La IA no devolvió un título y una descripción válidos.'
        );
      }

      // ----------------------------------------------
      // Aplicar resultado
      // ----------------------------------------------

      this.titulo =
        json.titulo.trim();

      this.descripcion =
        json.descripcion.trim();

    } catch (e: any) {

      console.error(
        'Error generarConIa:',
        e
      );

      this.errorIa =
        e?.message ??
        'No se pudo generar el texto. Inténtalo de nuevo.';

    } finally {

      this.generando = false;
    }
  }

  // --------------------------------------------------
  // ENVÍO
  // --------------------------------------------------

  async enviar() {

    // Limpiamos errores anteriores.

    this.error = '';
    this.erroresValidacion = [];

    // ----------------------------------------------
    // Validación rápida en frontend
    // ----------------------------------------------

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

    // ----------------------------------------------
    // Estado de envío
    // ----------------------------------------------

    this.enviando = true;

    const elementosConEmoji =
      this.elementos.map(e => ({
        tipo: e.tipo,

        etiqueta:
          this.getEtiqueta(e.tipo),

        emoji:
          this.getEmoji(e.tipo),

        barrio:
          e.barrio,

        coordenadas:
          e.coordenadas,
      }));

    try {

      const url =
        `${this.supabaseService.getFunctionUrl()}/enviar-propuesta`;

      const res =
        await fetch(url, {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            'apikey':
              this.supabaseService
                .getAnonKey(),
          },

          body: JSON.stringify({

            nombre:
              this.nombre.trim(),

            primerApellido:
              this.primerApellido.trim(),

            segundoApellido:
              this.segundoApellido.trim() ||
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
              this.descripcion.trim(),
          }),
        });

      const json =
        await res.json();

      // --------------------------------------------
      // Error devuelto por backend
      // --------------------------------------------

      if (
        !res.ok ||
        !json.ok
      ) {

        if (
          Array.isArray(
            json.detalles
          )
        ) {
          this.erroresValidacion =
            json.detalles;
        }

        this.error =
          json.error ??
          'No se pudo enviar la propuesta.';

        return;
      }

      // --------------------------------------------
      // Envío correcto
      // --------------------------------------------

      this.referencia =
        json.referencia;

      this.mobiliarioService
        .limpiarPropuesta();

    } catch (e) {

      // Error de red, servidor inaccesible,
      // respuesta no JSON, etc.

      this.error =
        'No se pudo conectar con el servidor. ' +
        'Inténtalo de nuevo.';

      console.error(
        'Error enviando propuesta:',
        e
      );

    } finally {

      this.enviando = false;
    }
  }

  // --------------------------------------------------
  // NAVEGACIÓN
  // --------------------------------------------------

  volver() {
    history.back();
  }
}