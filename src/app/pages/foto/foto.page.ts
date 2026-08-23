import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonSpinner
} from '@ionic/angular/standalone';
import { IdiomaSelectorComponent } from 'src/app/components/idioma-selector/idioma-selector.component';
import { SupabaseService } from 'src/app/core/services/supabase.service';
import { CATEGORIAS_ELEMENTOS, CategoriaElemento } from 'src/app/core/models/mobiliario.model';

@Component({
  selector: 'app-foto',
  templateUrl: './foto.page.html',
  styleUrls: ['./foto.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonSpinner,
    IdiomaSelectorComponent
  ]
})
export class FotoPage {

  paso: 'captura' | 'analizando' | 'resultado' = 'captura';

  fotoPreview: string | null = null;
  fotoBase64: string | null = null;

  categoriaDetectada: CategoriaElemento | null = null;
  mostrarSelectorCategoria = false;
  tituloGenerado = '';
  descripcionGenerada = '';

  coordenadas: { lat: number; lng: number } | null = null;

  error = '';
  errorGps = '';

  categoriasEspacioPublico = CATEGORIAS_ELEMENTOS.filter(c => c.grupo === 'espacio-publico');
  categoriasMedioambiente  = CATEGORIAS_ELEMENTOS.filter(c => c.grupo === 'medioambiente');

  constructor(
    private router: Router,
    private supabaseService: SupabaseService
  ) {}

  ionViewDidEnter(): void {
    this.obtenerGps();
  }

  private obtenerGps(): void {
    if (!navigator.geolocation) {
      this.errorGps = 'Tu dispositivo no soporta geolocalización';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.coordenadas = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      () => {
        this.errorGps = 'No se pudo obtener la ubicación — se usará el centro del mapa';
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }

  onFotoSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.procesarArchivo(file);
  }

  private procesarArchivo(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const resultado = e.target?.result as string;
      this.fotoPreview = resultado;
      this.fotoBase64 = resultado.split(',')[1];
    };
    reader.readAsDataURL(file);
  }

  async analizarFoto(): Promise<void> {
    if (!this.fotoBase64) return;
    this.paso = 'analizando';
    this.error = '';

    try {
      const url = `${this.supabaseService.getFunctionUrl()}/analizar-foto`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseService.getAnonKey(),
        },
        body: JSON.stringify({ imagenBase64: this.fotoBase64 }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      this.categoriaDetectada = CATEGORIAS_ELEMENTOS.find(c => c.tipo === json.tipo) ?? CATEGORIAS_ELEMENTOS[0];
      this.tituloGenerado = json.titulo;
      this.descripcionGenerada = json.descripcion;
      this.mostrarSelectorCategoria = false;
      this.paso = 'resultado';

    } catch (e: any) {
      this.error = 'No se pudo analizar la foto. Inténtalo de nuevo.';
      this.paso = 'captura';
      console.error(e);
    }
  }

  cambiarCategoria(cat: CategoriaElemento): void {
    this.categoriaDetectada = cat;
    this.mostrarSelectorCategoria = false;
  }

  repetirFoto(): void {
    this.fotoPreview = null;
    this.fotoBase64 = null;
    this.categoriaDetectada = null;
    this.tituloGenerado = '';
    this.descripcionGenerada = '';
    this.error = '';
    this.mostrarSelectorCategoria = false;
    this.paso = 'captura';
  }

  confirmar(): void {
    this.router.navigate(['/resumen'], {
      state: {
        desdeFoto: true,
        categoria: this.categoriaDetectada,
        titulo: this.tituloGenerado,
        descripcion: this.descripcionGenerada,
        coordenadas: this.coordenadas,
      }
    });
  }

  volver(): void {
    this.router.navigate(['/chat']);
  }
}