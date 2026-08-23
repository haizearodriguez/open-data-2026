import { Injectable } from '@angular/core';
import {
  createClient,
  SupabaseClient
} from '@supabase/supabase-js';

import { environment } from 'src/environments/environment';

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

  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.anonKey
    );
  }

  /**
   * Carga los datos del dashboard mediante la Edge Function.
   *
   * IMPORTANTE:
   * Angular NO consulta directamente la tabla propuestas.
   *
   * La consulta se realiza dentro de la Edge Function
   * utilizando la SUPABASE_SERVICE_ROLE_KEY.
   */
  async cargarDashboard(): Promise<DashboardData> {
    const url = `${this.getFunctionUrl()}/dashboard`;
    const anonKey = this.getAnonKey();

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
    });

    let json: any;

    try {
      json = await response.json();
    } catch {
      throw new Error(
        `El servidor devolvió una respuesta no válida. HTTP ${response.status}.`
      );
    }

    if (!response.ok || !json?.ok) {
      console.error('Respuesta de Edge Function /dashboard:', json);

      const detalle =
        json?.detalle ||
        json?.details ||
        json?.message ||
        json?.error;

      throw new Error(
        `${detalle ?? 'No se pudieron cargar los datos del dashboard.'} HTTP ${response.status}.`
      );
    }

    if (!json.data) {
      throw new Error(
        'La respuesta del dashboard no contiene datos.'
      );
    }

    return json.data as DashboardData;
  }

  /**
   * URL base de las Edge Functions.
   */
  public getFunctionUrl(): string {

    return (
      `${environment.supabase.url}/functions/v1`
    );
  }

  /**
   * Anon key.
   *
   * Esta clave es pública.
   */
  public getAnonKey(): string {

    return environment.supabase.anonKey;
  }
}