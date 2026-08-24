import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

export interface GenerarTextoResponse {
  ok: boolean;
  titulo?: string;
  descripcion?: string;
  [key: string]: unknown;
}

export interface AnalizarFotoResponse {
  ok: boolean;
  tipo?: string;
  titulo?: string;
  descripcion?: string;
  [key: string]: unknown;
}

export interface EnviarPropuestaPayload {
  nombre: string;
  primerApellido: string;
  segundoApellido?: string;
  dni: string;
  emailCiudadano: string;
  barrio: string;
  elementos: unknown[];
  titulo: string;
  detalle: string;
}

@Injectable({ providedIn: 'root' })
export class FunctionsService {
  private readonly baseUrl = `${environment.supabase.url}/functions/v1`;
  private readonly anonKey = environment.supabase.anonKey;

  async get<T>(functionName: string): Promise<T> {
    return this.request<T>(functionName, { method: 'GET' });
  }

  async post<T>(functionName: string, body: unknown): Promise<T> {
    return this.request<T>(functionName, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  private async request<T>(functionName: string, options: RequestInit): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/${functionName}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          apikey: this.anonKey,
          Authorization: `Bearer ${this.anonKey}`,
          ...(options.headers ?? {}),
        },
      });
    } catch {
      throw new Error('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new Error(`El servidor devolvió una respuesta no válida. HTTP ${response.status}.`);
    }

    const payload = (json ?? {}) as Record<string, unknown>;

    if (!response.ok || payload['ok'] === false) {
      throw new FunctionsError(
        this.getSafeMessage(payload, response.status),
        response.status,
        payload
      );
    }

    return json as T;
  }

  private getSafeMessage(payload: Record<string, unknown>, status: number): string {
    if (Array.isArray(payload['detalles']) && payload['detalles'].length) {
      return payload['detalles'].filter((item): item is string => typeof item === 'string').join(' ');
    }

    if (typeof payload['error'] === 'string') return payload['error'];
    if (status >= 500) return 'El servidor no ha podido completar la operación.';
    return 'No se ha podido completar la operación.';
  }
}

export class FunctionsError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'FunctionsError';
  }
}
