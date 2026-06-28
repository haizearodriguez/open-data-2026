import { Injectable } from '@angular/core';
import { ElementoMobiliario, CATEGORIAS_ELEMENTOS } from '../models/mobiliario.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class MobiliarioService {
  private elementosPropuestos: ElementoMobiliario[] = [];

  constructor(private supabaseService: SupabaseService) {}

  /**
   * Registra un elemento en memoria y lo persiste en Supabase
   */
  public async guardarElementoTemporal(elemento: ElementoMobiliario): Promise<void> {
    this.elementosPropuestos.push(elemento);

    // Busca emoji y etiqueta desde el modelo para guardarlos en Supabase
    const categoria = CATEGORIAS_ELEMENTOS.find(c => c.tipo === elemento.tipo);
    if (categoria) {
      try {
        await this.supabaseService.guardarSugerencia(
          elemento,
          categoria.emoji,
          categoria.etiqueta
        );
      } catch (error) {
        console.error('Error al guardar sugerencia en Supabase:', error);
      }
    }
  }

  public obtenerPropuestaActual(): ElementoMobiliario[] {
    return this.elementosPropuestos;
  }

  public limpiarPropuesta(): void {
    this.elementosPropuestos = [];
  }
}