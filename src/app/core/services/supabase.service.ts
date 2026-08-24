import { Injectable } from '@angular/core';
import { FunctionsService } from './functions.service';

interface Propuesta {
  referencia: string;
  barrio: string;
  titulo: string;

  elementos: Array<{
    tipo: string;
    etiqueta: string;
    emoji: string;
    barrio?: string;
    coordenadas?: {
      lat: number;
      lng: number;
    };
  }>;

  num_elementos: number;
  created_at: string;
}

export interface DashboardData {
  total: number;
  totalElementos: number;

  porTipo: {
    tipo: string;
    etiqueta: string;
    emoji: string;
    count: number;
  }[];

  porBarrio: {
    barrio: string;
    count: number;
  }[];

  porSemana: {
    semana: number;
    count: number;
  }[];

  ultimas: Propuesta[];
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {

  constructor(
    private functions: FunctionsService
  ) {}

  /**
   * Carga los datos del dashboard mediante la Edge Function.
   *
   * Angular no consulta directamente la tabla propuestas.
   */
  async cargarDashboard(): Promise<DashboardData> {

    const response =
      await this.functions.get<{
        data?: DashboardData;
      }>('dashboard');

    if (!response.data) {
      throw new Error(
        'La respuesta del dashboard no contiene datos.'
      );
    }

    return response.data;
  }
}