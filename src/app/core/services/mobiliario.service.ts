import { Injectable } from '@angular/core';
import { ElementoMobiliario, CATEGORIAS_ELEMENTOS } from '../models/mobiliario.model';

@Injectable({ providedIn: 'root' })
export class MobiliarioService {
  // Map para buscar por ID eficientemente
  private elementosMap = new Map<string, ElementoMobiliario>();

  constructor() {}

  public guardarElementoTemporal(elemento: ElementoMobiliario) :void {
    const id = elemento.id ?? `elem-${Date.now()}`;
    this.elementosMap.set(id, { ...elemento, id });
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