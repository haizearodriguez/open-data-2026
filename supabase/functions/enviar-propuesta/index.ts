import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  validarPropuesta,
  type PropuestaPayload,
} from './validation.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const EMAIL_PRUEBAS = '96haizea@gmail.com';
const EMAIL_FROM = 'onboarding@resend.dev';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type PropuestaConReferencia = PropuestaPayload & {
  referencia: string;
};

/**
 * Escapa caracteres especiales para evitar HTML injection
 * al insertar datos proporcionados por el usuario en emails HTML.
 */
function escapeHtml(valor: string): string {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * Genera la referencia oficial de la propuesta.
 *
 * La referencia se genera exclusivamente en backend.
 * El cliente no puede decidirla.
 *
 * Ejemplo:
 * VGZ-20260823-A7F42C91
 */
function generarReferencia(): string {
  const fecha = new Date();

  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');

  const identificador = crypto
    .randomUUID()
    .replaceAll('-', '')
    .substring(0, 8)
    .toUpperCase();

  return `VGZ-${año}${mes}${dia}-${identificador}`;
}

/**
 * Genera el email destinado al Ayuntamiento.
 */
function generarHtmlAyuntamiento(
  p: PropuestaConReferencia
): string {
  const filaElementos = p.elementos
    .map(
      (e) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">
            ${escapeHtml(e.emoji)}
            ${escapeHtml(e.etiqueta)}
          </td>

          <td style="padding:8px;border:1px solid #ddd;">
            ${e.coordenadas.lat.toFixed(6)},
            ${e.coordenadas.lng.toFixed(6)}
          </td>
        </tr>
      `
    )
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">

      <div style="background:#2dd36f;padding:20px;border-radius:8px 8px 0 0;">

        <h1 style="color:white;margin:0;font-size:20px;">
          📬 Nueva propuesta ciudadana
        </h1>

        <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:14px;">
          Nº referencia:
          <strong>${escapeHtml(p.referencia)}</strong>
        </p>

      </div>

      <div style="background:#f9f9f9;padding:20px;border:1px solid #eee;">

        <h2 style="font-size:15px;color:#333;margin:0 0 12px;">
          Datos del ciudadano
        </h2>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">

          <tr>
            <td style="padding:6px 0;color:#888;width:160px;">
              Nombre completo
            </td>

            <td style="padding:6px 0;font-weight:600;">
              ${escapeHtml(p.nombre)}
              ${escapeHtml(p.primerApellido)}
              ${escapeHtml(p.segundoApellido ?? '')}
            </td>
          </tr>

          <tr>
            <td style="padding:6px 0;color:#888;">
              DNI/NIE
            </td>

            <td style="padding:6px 0;font-weight:600;">
              ${escapeHtml(p.dni)}
            </td>
          </tr>

          <tr>
            <td style="padding:6px 0;color:#888;">
              Email
            </td>

            <td style="padding:6px 0;font-weight:600;">
              ${escapeHtml(p.emailCiudadano)}
            </td>
          </tr>

          <tr>
            <td style="padding:6px 0;color:#888;">
              Barrio
            </td>

            <td style="padding:6px 0;font-weight:600;">
              ${escapeHtml(p.barrio)}
            </td>
          </tr>

        </table>
      </div>

      <div style="background:white;padding:20px;border:1px solid #eee;border-top:none;">

        <h2 style="font-size:15px;color:#333;margin:0 0 8px;">
          📌 ${escapeHtml(p.titulo)}
        </h2>

        <p style="font-size:14px;color:#555;line-height:1.6;">
          ${escapeHtml(p.detalle)}
        </p>

      </div>

      <div style="background:white;padding:20px;border:1px solid #eee;border-top:none;">

        <h2 style="font-size:15px;color:#333;margin:0 0 12px;">
          Elementos propuestos (${p.elementos.length})
        </h2>

        <table style="width:100%;border-collapse:collapse;font-size:14px;">

          <thead>
            <tr style="background:#f0f0f0;">

              <th style="padding:8px;border:1px solid #ddd;text-align:left;">
                Elemento
              </th>

              <th style="padding:8px;border:1px solid #ddd;text-align:left;">
                Coordenadas
              </th>

            </tr>
          </thead>

          <tbody>
            ${filaElementos}
          </tbody>

        </table>
      </div>

      <div style="background:#f9f9f9;padding:14px 20px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">

        <p style="font-size:12px;color:#aaa;margin:0;">
          Enviado desde la app Vitoria Ciudadana ·
          ${new Date().toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </p>

      </div>

    </div>
  `;
}

/**
 * Genera el email de confirmación para el ciudadano.
 */
function generarHtmlCiudadano(
  p: PropuestaConReferencia
): string {
  const listaElementos = p.elementos
    .map(
      (e) => `
        <li style="padding:4px 0;">
          ${escapeHtml(e.emoji)}
          ${escapeHtml(e.etiqueta)}
        </li>
      `
    )
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">

      <div style="background:#2dd36f;padding:20px;border-radius:8px 8px 0 0;">

        <h1 style="color:white;margin:0;font-size:20px;">
          ✅ Tu propuesta ha sido enviada
        </h1>

      </div>

      <div style="background:white;padding:24px;border:1px solid #eee;">

        <p style="font-size:15px;color:#333;">
          Hola <strong>${escapeHtml(p.nombre)}</strong>,
        </p>

        <p style="font-size:14px;color:#555;line-height:1.6;">
          Tu propuesta para el barrio de
          <strong>${escapeHtml(p.barrio)}</strong>
          ha sido enviada correctamente al Ayuntamiento de
          Vitoria-Gasteiz.
        </p>

        <div style="background:#f0fff4;border-left:4px solid #2dd36f;padding:12px 16px;border-radius:4px;margin:16px 0;">

          <p style="margin:0;font-size:13px;color:#555;">
            Número de referencia
          </p>

          <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#2dd36f;letter-spacing:2px;">
            ${escapeHtml(p.referencia)}
          </p>

        </div>

        <h3 style="font-size:14px;color:#333;margin:20px 0 8px;">
          Elementos incluidos en tu propuesta:
        </h3>

        <ul style="font-size:14px;color:#555;padding-left:20px;margin:0;">
          ${listaElementos}
        </ul>

        <p style="font-size:13px;color:#888;margin-top:24px;line-height:1.6;">

          Guarda este número de referencia para hacer seguimiento
          de tu solicitud en el

          <a
            href="https://www.vitoria-gasteiz.org/wb021/was/areaAction.do?idioma=es&accion=inicio"
            style="color:#2dd36f;"
          >
            Buzón Ciudadano
          </a>.

        </p>

      </div>

      <div style="background:#f9f9f9;padding:14px 20px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">

        <p style="font-size:12px;color:#aaa;margin:0;">
          Vitoria Ciudadana · Ayuntamiento de Vitoria-Gasteiz
        </p>

      </div>

    </div>
  `;
}

serve(async (req) => {

  // --------------------------------------------------
  // CORS preflight
  // --------------------------------------------------

  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: CORS_HEADERS,
    });
  }

  try {

    // --------------------------------------------------
    // 1. Leer petición
    // --------------------------------------------------

    const payload = await req.json();

    // --------------------------------------------------
    // 2. Validar datos en servidor
    // --------------------------------------------------

    const errores = validarPropuesta(payload);

    if (errores.length > 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Datos de propuesta no válidos.',
          detalles: errores,
        }),
        {
          status: 400,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // --------------------------------------------------
    // 3. Generar referencia en backend
    // --------------------------------------------------

    const referencia = generarReferencia();

    const propuesta: PropuestaConReferencia = {
      ...(payload as PropuestaPayload),
      referencia,
    };

    // --------------------------------------------------
    // 4. Cliente Supabase de servidor
    // --------------------------------------------------

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_KEY
    );

    // --------------------------------------------------
    // 5. Guardar propuesta
    // --------------------------------------------------

    const {
      error: errorPropuesta,
    } = await supabase
      .from('propuestas')
      .insert({
        referencia,

        nombre:
          propuesta.nombre.trim(),

        primer_apellido:
          propuesta.primerApellido.trim(),

        segundo_apellido:
          propuesta.segundoApellido?.trim() || null,

        dni:
          propuesta.dni.trim().toUpperCase(),

        email:
          propuesta.emailCiudadano
            .trim()
            .toLowerCase(),

        barrio:
          propuesta.barrio.trim(),

        titulo:
          propuesta.titulo.trim(),

        detalle:
          propuesta.detalle.trim(),

        elementos:
          propuesta.elementos,

        num_elementos:
          propuesta.elementos.length,
      });

    if (errorPropuesta) {
      throw new Error(
        `Error guardando propuesta: ${errorPropuesta.message}`
      );
    }

    // --------------------------------------------------
    // 6. Email al Ayuntamiento
    // --------------------------------------------------

    const resAyto = await fetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${RESEND_API_KEY}`,

          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          from: EMAIL_FROM,

          // En pruebas se utiliza el email autorizado.
          // En producción:
          // to: ['informacion@vitoria-gasteiz.org']
          to: [EMAIL_PRUEBAS],

          reply_to:
            propuesta.emailCiudadano,

          subject:
            `[Propuesta Ciudadana ${referencia}] ` +
            `${propuesta.titulo} · ` +
            `${propuesta.barrio}`,

          html:
            generarHtmlAyuntamiento(
              propuesta
            ),
        }),
      }
    );

    if (!resAyto.ok) {
      const err =
        await resAyto.text();

      throw new Error(
        `Error enviando email al ayuntamiento: ${err}`
      );
    }

    // --------------------------------------------------
    // 7. Email de confirmación
    // --------------------------------------------------

    const resCiudadano = await fetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${RESEND_API_KEY}`,

          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          from: EMAIL_FROM,

          // En pruebas se utiliza el email autorizado.
          // En producción:
          // to: [propuesta.emailCiudadano]
          to: [EMAIL_PRUEBAS],

          subject:
            `✅ Propuesta enviada · Ref. ${referencia}`,

          html:
            generarHtmlCiudadano(
              propuesta
            ),
        }),
      }
    );

    if (!resCiudadano.ok) {
      const err =
        await resCiudadano.text();

      throw new Error(
        `Error enviando confirmación al ciudadano: ${err}`
      );
    }

    // --------------------------------------------------
    // 8. Respuesta correcta
    // --------------------------------------------------

    return new Response(
      JSON.stringify({
        ok: true,
        referencia,
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

    console.error(
      'Error en enviar-propuesta:',
      error
    );

    return new Response(
      JSON.stringify({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Error interno del servidor',
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