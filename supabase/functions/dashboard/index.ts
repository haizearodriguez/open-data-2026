/// <reference lib="deno.ns" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

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

interface DashboardData {
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
  ultimas: Array<{
    referencia: string;
    barrio: string;
    titulo: string;
    num_elementos: number;
    created_at: string;
  }>;
}

/**
 * Agrupa las propuestas de las últimas 5 semanas.
 */
function agruparPorSemana(
  rows: Propuesta[]
): { semana: number; count: number }[] {

  const ahora = new Date();

  const resultado: {
    semana: number;
    count: number;
  }[] = [];

  for (let i = 4; i >= 0; i--) {

    const inicio = new Date(ahora);

    inicio.setDate(
      ahora.getDate() - (i + 1) * 7
    );

    const fin = new Date(ahora);

    fin.setDate(
      ahora.getDate() - i * 7
    );

    const count = rows.filter(row => {

      const fecha =
        new Date(row.created_at);

      return (
        fecha >= inicio &&
        fecha < fin
      );

    }).length;

    resultado.push({
      semana: 5 - i,
      count,
    });
  }

  return resultado;
}

serve(async (req) => {

  // --------------------------------------------------
  // CORS
  // --------------------------------------------------

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: CORS_HEADERS,
    });
  }

  // Solo permitimos GET y POST.
  if (
    req.method !== 'GET' &&
    req.method !== 'POST'
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Método no permitido.',
      }),
      {
        status: 405,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  try {

    // ------------------------------------------------
    // Cliente con SERVICE ROLE
    // ------------------------------------------------
    //
    // Esta clave SOLO existe en la Edge Function.
    // Nunca llega al navegador.
    //

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_KEY
    );

    // ------------------------------------------------
    // Obtener propuestas
    // ------------------------------------------------

    const {
      data,
      error,
    } = await supabase
      .from('propuestas')
      .select(
        `
          referencia,
          barrio,
          titulo,
          elementos,
          num_elementos,
          created_at
        `
      )
      .order(
        'created_at',
        { ascending: false }
      );

    if (error) {

        return new Response(
            JSON.stringify({
            ok: false,
            error: 'Error consultando propuestas',
            detalle: error.message,
            codigo: error.code,
            detalles: error.details,
            hint: error.hint,
            }),
            {
            status: 500,
            headers: {
                ...CORS_HEADERS,
                'Content-Type': 'application/json',
            },
            }
        );
        }

    const rows =
      (data ?? []) as Propuesta[];

    // ------------------------------------------------
    // Total
    // ------------------------------------------------

    const total =
      rows.length;

    // ------------------------------------------------
    // Total de elementos
    // ------------------------------------------------

    const totalElementos =
      rows.reduce(
        (sum, row) =>
          sum +
          (row.num_elementos ?? 0),
        0
      );

    // ------------------------------------------------
    // Por tipo
    // ------------------------------------------------

    const mapasTipo =
      new Map<
        string,
        {
          etiqueta: string;
          emoji: string;
          count: number;
        }
      >();

    rows.forEach(row => {

      (row.elementos ?? [])
        .forEach(elemento => {

          if (!elemento?.tipo) {
            return;
          }

          if (
            !mapasTipo.has(
              elemento.tipo
            )
          ) {

            mapasTipo.set(
              elemento.tipo,
              {
                etiqueta:
                  elemento.etiqueta ??
                  elemento.tipo,

                emoji:
                  elemento.emoji ??
                  '📍',

                count: 0,
              }
            );
          }

          mapasTipo.get(
            elemento.tipo
          )!.count++;
        });
    });

    const porTipo =
      Array.from(
        mapasTipo.entries()
      )
        .map(
          ([tipo, valor]) => ({
            tipo,
            ...valor,
          })
        )
        .sort(
          (a, b) =>
            b.count - a.count
        );

    // ------------------------------------------------
    // Por barrio
    // ------------------------------------------------

    const mapasBarrio =
      new Map<string, number>();

    rows.forEach(row => {

      const barrio =
        row.barrio?.trim();

      if (!barrio) {
        return;
      }

      mapasBarrio.set(
        barrio,
        (mapasBarrio.get(barrio) ?? 0) + 1
      );
    });

    const porBarrio =
      Array.from(
        mapasBarrio.entries()
      )
        .map(
          ([barrio, count]) => ({
            barrio,
            count,
          })
        )
        .sort(
          (a, b) =>
            b.count - a.count
        )
        .slice(0, 6);

    // ------------------------------------------------
    // Por semana
    // ------------------------------------------------

    const porSemana =
      agruparPorSemana(rows);

    // ------------------------------------------------
    // Últimas propuestas
    // ------------------------------------------------
    //
    // IMPORTANTE:
    // No devolvemos nombre, DNI, email ni detalle.
    // El dashboard solo necesita información
    // estadística y administrativa.
    //

    const ultimas =
      rows
        .slice(0, 10)
        .map(row => ({
          referencia:
            row.referencia,

          barrio:
            row.barrio,

          titulo:
            row.titulo,

          num_elementos:
            row.num_elementos,

          created_at:
            row.created_at,
        }));

    // ------------------------------------------------
    // Respuesta
    // ------------------------------------------------

    const dashboard: DashboardData = {
      total,
      totalElementos,
      porTipo,
      porBarrio,
      porSemana,
      ultimas,
    };

    return new Response(
      JSON.stringify({
        ok: true,
        data: dashboard,
      }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type':
            'application/json',
        },
      }
    );

  } catch (error) {



    return new Response(
      JSON.stringify({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Error interno del servidor.',
      }),
      {
        status: 500,
        headers: {
          ...CORS_HEADERS,
          'Content-Type':
            'application/json',
        },
      }
    );
  }
});