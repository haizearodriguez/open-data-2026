import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from 'src/environments/environment';
import { ElementoMobiliario } from '../models/mobiliario.model';

export interface Sugerencia {
  id?: string;
  tipo: string;
  etiqueta: string;
  emoji: string;
  barrio: string;
  lng: number;
  lat: number;
  created_at?: string;
}

export interface DashboardData {
  total: number;
  porTipo: { tipo: string; etiqueta: string; emoji: string; count: number }[];
  porBarrio: { barrio: string; count: number }[];
  porSemana: { semana: number; count: number }[];
  ultimas: Sugerencia[];
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.anonKey
    );
  }

  async guardarSugerencia(elemento: ElementoMobiliario, emoji: string, etiqueta: string): Promise<void> {
    const { error } = await this.supabase
      .from('sugerencias')
      .insert({
        tipo: elemento.tipo,
        etiqueta,
        emoji,
        barrio: elemento.barrio,
        lng: elemento.coordenadas.lng,
        lat: elemento.coordenadas.lat,
      });
    if (error) throw error;
  }

  async cargarDashboard(): Promise<DashboardData> {
    const { data, error } = await this.supabase
      .from('sugerencias')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows: Sugerencia[] = data ?? [];

    const total = rows.length;

    const mapasTipo = new Map<string, { etiqueta: string; emoji: string; count: number }>();
    rows.forEach(r => {
      if (!mapasTipo.has(r.tipo)) {
        mapasTipo.set(r.tipo, { etiqueta: r.etiqueta, emoji: r.emoji, count: 0 });
      }
      mapasTipo.get(r.tipo)!.count++;
    });
    const porTipo = Array.from(mapasTipo.entries())
      .map(([tipo, v]) => ({ tipo, ...v }))
      .sort((a, b) => b.count - a.count);

    const mapasBarrio = new Map<string, number>();
    rows.forEach(r => mapasBarrio.set(r.barrio, (mapasBarrio.get(r.barrio) ?? 0) + 1));
    const porBarrio = Array.from(mapasBarrio.entries())
      .map(([barrio, count]) => ({ barrio, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const porSemana = this.agruparPorSemana(rows);
    const ultimas = rows.slice(0, 10);

    return { total, porTipo, porBarrio, porSemana, ultimas };
  }

  private agruparPorSemana(rows: Sugerencia[]): { semana: number; count: number }[] {
    const ahora = new Date();
    const resultado: { semana: number; count: number }[] = [];

    for (let i = 4; i >= 0; i--) {
      const inicio = new Date(ahora);
      inicio.setDate(ahora.getDate() - (i + 1) * 7);
      const fin = new Date(ahora);
      fin.setDate(ahora.getDate() - i * 7);

      const count = rows.filter(r => {
        const fecha = new Date(r.created_at!);
        return fecha >= inicio && fecha < fin;
      }).length;

      resultado.push({ semana: 5 - i, count });
    }

    return resultado;
  }

  // ─── Métodos auxiliares para Edge Functions ───────────────────────────────

  public getFunctionUrl(): string {
    return `${environment.supabase.url}/functions/v1`;
  }

  public getAnonKey(): string {
    return environment.supabase.anonKey;
  }
}