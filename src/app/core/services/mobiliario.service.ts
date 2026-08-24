import { Injectable } from '@angular/core';
import { ElementoMobiliario } from '../models/mobiliario.model';

@Injectable({
  providedIn: 'root'
})
export class MobiliarioService {

  /**
   * Elementos de la propuesta actual.
   *
   * Usamos un Map para poder:
   * - añadir por ID
   * - eliminar por ID
   * - evitar duplicados del mismo ID
   */
  private elementosMap =
    new Map<string, ElementoMobiliario>();

  /**
   * Añade o actualiza un elemento de la propuesta.
   */
  guardarElementoTemporal(
    elemento: ElementoMobiliario
  ): void {

    const id =
      elemento.id ??
      `elem-${Date.now()}`;

    this.elementosMap.set(
      id,
      {
        ...elemento,
        id
      }
    );
  }

  /**
   * Elimina un elemento concreto.
   */
  eliminarElementoPorId(
    id: string
  ): void {

    this.elementosMap.delete(id);
  }

  /**
   * Devuelve todos los elementos
   * de la propuesta actual.
   */
  obtenerPropuestaActual():
    ElementoMobiliario[] {

    return Array.from(
      this.elementosMap.values()
    );
  }

  /**
   * Empieza una propuesta completamente nueva.
   */
  limpiarPropuesta(): void {
    this.elementosMap.clear();
  }
}