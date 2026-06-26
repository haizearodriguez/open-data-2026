import { Injectable } from '@angular/core';
import { ElementoMobiliario } from '../models/mobiliario.model';

@Injectable({
  providedIn: 'root'
})
export class MobiliarioService {
  // Lista temporal en memoria de la propuesta actual del ciudadano
  private elementosPropuestos: ElementoMobiliario[] = [];

  constructor() {}

  /**
   * Registra temporalmente un elemento plantado en el mapa
   */
  public guardarElementoTemporal(elemento: ElementoMobiliario): void {
    this.elementosPropuestos.push(elemento);
    console.log('Mobiliario registrado en la propuesta actual:', this.elementosPropuestos);
  }

  /**
   * Devuelve todos los elementos que el usuario ha diseñado para la pantalla de Resumen
   */
  public obtenerPropuestaActual(): ElementoMobiliario[] {
    return this.elementosPropuestos;
  }

  /**
   * Limpia el borrador (por si cancela o finaliza el envío)
   */
  public limpiarPropuesta(): void {
    this.elementosPropuestos = [];
  }
}