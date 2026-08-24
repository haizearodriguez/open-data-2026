import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonSpinner
} from '@ionic/angular/standalone';

import { IdiomaSelectorComponent } from 'src/app/components/idioma-selector/idioma-selector.component';
import { FunctionsService } from 'src/app/core/services/functions.service';
import {
  CATEGORIAS_ELEMENTOS,
  CategoriaElemento
} from 'src/app/core/models/mobiliario.model';
import { MapaService }
  from 'src/app/core/services/mapa.service';

@Component({
  selector: 'app-foto',
  templateUrl: './foto.page.html',
  styleUrls: ['./foto.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonSpinner,
    IdiomaSelectorComponent  ]
})
export class FotoPage {

  paso: 'captura' | 'analizando' | 'resultado' = 'captura';

  fotoPreview: string | null = null;
  fotoBase64: string | null = null;

  categoriaDetectada: CategoriaElemento | null = null;
  mostrarSelectorCategoria = false;

  tituloGenerado = '';
  descripcionGenerada = '';

  coordenadas: {
    lat: number;
    lng: number;
  } | null = null;

  barrio = '';
  error = '';
  errorGps = '';

  categoriasEspacioPublico =
    CATEGORIAS_ELEMENTOS.filter(
      c => c.grupo === 'espacio-publico'
    );

  categoriasMedioambiente =
    CATEGORIAS_ELEMENTOS.filter(
      c => c.grupo === 'medioambiente'
    );

  constructor(
    private router: Router,
    private functions: FunctionsService,
    private mapaService: MapaService
  ) {}

  // --------------------------------------------------
  // Entrada en la página
  // --------------------------------------------------

  ionViewDidEnter(): void {
    this.obtenerGps();
  }

  // --------------------------------------------------
  // GPS
  // --------------------------------------------------

 private obtenerGps(): void {

    if (!navigator.geolocation) {
      this.errorGps =
        'Tu dispositivo no soporta geolocalización';

      return;
    }

    navigator.geolocation.getCurrentPosition(

      async (pos) => {

        this.coordenadas = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };

        try {

          this.barrio =
            await this.mapaService
              .obtenerBarrioPorCoordenadas(
                this.coordenadas.lng,
                this.coordenadas.lat
              ) ?? '';


        } catch (error) {

          this.barrio = '';
        }
      },

      (error) => {
        this.errorGps =
          'No se ha podido obtener tu ubicación';
      },

      {
        timeout: 8000,
        enableHighAccuracy: true
      }
    );
  }

  // --------------------------------------------------
  // Selección de foto
  // --------------------------------------------------

  onFotoSeleccionada(event: Event): void {

    const input =
      event.target as HTMLInputElement;

    const file =
      input.files?.[0];

    if (!file) {
      return;
    }

    this.procesarArchivo(file);
  }

  // --------------------------------------------------
  // Procesar archivo
  // --------------------------------------------------

  private procesarArchivo(file: File): void {

    this.error = '';

    // Comprobación del tipo
    if (!file.type.startsWith('image/')) {

      this.error =
        'El archivo seleccionado no es una imagen válida.';

      return;
    }

    // Comprobación de tamaño
    //
    // Evitamos enviar fotografías enormes
    // innecesariamente a la Edge Function.
    //

    const maxSize =
      10 * 1024 * 1024;

    if (file.size > maxSize) {

      this.error =
        'La imagen es demasiado grande. Utiliza una foto de menos de 10 MB.';

      return;
    }

    const reader =
      new FileReader();

    reader.onload = (e) => {

      const resultado =
        e.target?.result as string;

      if (!resultado) {

        this.error =
          'No se pudo procesar la imagen.';

        return;
      }

      this.fotoPreview =
        resultado;

      // Resultado:
      //
      // data:image/jpeg;base64,XXXXX
      //
      // Nos quedamos solamente con XXXXX.
      //

      const partes =
        resultado.split(',');

      if (partes.length < 2) {

        this.error =
          'El formato de la imagen no es válido.';

        return;
      }

      this.fotoBase64 =
        partes[1];
    };

    reader.onerror = () => {

      this.error =
        'No se pudo leer la imagen.';

      this.fotoPreview = null;
      this.fotoBase64 = null;
    };

    reader.readAsDataURL(file);
  }

  // --------------------------------------------------
  // Analizar fotografía con IA
  // --------------------------------------------------

  async analizarFoto(): Promise<void> {

    if (!this.fotoBase64) {

      this.error =
        'Primero selecciona una fotografía.';

      return;
    }

    this.paso = 'analizando';
    this.error = '';

    try {

      const json = await this.functions.post<{
        ok: boolean;
        tipo?: string;
        titulo?: string;
        descripcion?: string;
      }>('analizar-foto', {
        imagenBase64: this.fotoBase64,
        barrio: this.barrio || undefined
      });

      if (typeof json.tipo !== 'string' || typeof json.titulo !== 'string' || typeof json.descripcion !== 'string') {
        throw new Error('La IA devolvió una respuesta incompleta.');
      }

      // ------------------------------------------------
      // Buscar categoría en el modelo Angular
      // ------------------------------------------------

      const categoria =
        CATEGORIAS_ELEMENTOS.find(
          c => c.tipo === json.tipo
        );

      if (!categoria) {

        throw new Error(
          `La IA devolvió una categoría no reconocida: ${json.tipo}`
        );
      }

      // ------------------------------------------------
      // Guardar resultado
      // ------------------------------------------------

      this.categoriaDetectada =
        categoria;

      this.tituloGenerado =
        json.titulo.trim();

      this.descripcionGenerada =
        json.descripcion.trim();

      this.mostrarSelectorCategoria =
        false;

      this.paso =
        'resultado';

    } catch (error) {

      // ------------------------------------------------
      // ERROR COMPLETO
      // ------------------------------------------------

      this.error =
        error instanceof Error
          ? error.message
          : 'No se pudo analizar la foto.';

      this.paso =
        'captura';

    }
  }

  // --------------------------------------------------
  // Cambiar categoría manualmente
  // --------------------------------------------------

  cambiarCategoria(
    cat: CategoriaElemento
  ): void {

    this.categoriaDetectada =
      cat;

    this.mostrarSelectorCategoria =
      false;
  }

  // --------------------------------------------------
  // Repetir fotografía
  // --------------------------------------------------

  repetirFoto(): void {

    this.fotoPreview = null;

    this.fotoBase64 = null;

    this.categoriaDetectada = null;

    this.tituloGenerado = '';

    this.descripcionGenerada = '';

    this.error = '';

    this.mostrarSelectorCategoria =
      false;

    this.paso =
      'captura';
  }

  // --------------------------------------------------
  // Confirmar resultado
  // --------------------------------------------------

  confirmar(): void {

    if (!this.categoriaDetectada) {

      this.error =
        'No se ha detectado ninguna categoría.';

      return;
    }

    this.router.navigate(
      ['/resumen'],
      {
        state: {

          desdeFoto: true,

          categoria:
            this.categoriaDetectada,

          titulo:
            this.tituloGenerado,

          descripcion:
            this.descripcionGenerada,

          barrio:
            this.barrio,

          coordenadas:
            this.coordenadas
        }
      }
    );
  }

  // --------------------------------------------------
  // Volver al chat
  // --------------------------------------------------

  volver(): void {

    this.router.navigate(
      ['/chat']
    );
  }
}