import { Injectable } from '@angular/core';
import { ElementoMobiliario, CATEGORIAS_ELEMENTOS } from '../models/mobiliario.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class MobiliarioService {
  // Map para buscar por ID eficientemente
  private elementosMap = new Map<string, ElementoMobiliario>();

  constructor(private supabaseService: SupabaseService) {}

  public async guardarElementoTemporal(elemento: ElementoMobiliario): Promise<void> {
    const id = elemento.id ?? `elem-${Date.now()}`;
    this.elementosMap.set(id, { ...elemento, id });

    const categoria = CATEGORIAS_ELEMENTOS.find(c => c.tipo === elemento.tipo);
    if (categoria) {
      try {
        await this.supabaseService.guardarSugerencia(elemento, categoria.emoji, categoria.etiqueta);
      } catch (error) {
        console.error('Error al guardar sugerencia en Supabase:', error);
      }
    }
  }

  public eliminarElementoPorId(id: string): void {
    this.elementosMap.delete(id);
  }

  public obtenerPropuestaActual(): ElementoMobiliario[] {
    return Array.from(this.elementosMap.values());
  }

  public limpiarPropuesta(): void {
    this.elementosMap.clear();
  }
}