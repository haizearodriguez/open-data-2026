import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EMAIL_PRUEBAS = '96haizea@gmail.com'; // ← único email permitido en modo test
const EMAIL_FROM = 'onboarding@resend.dev';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ElementoPropuesta {
  tipo: string;
  etiqueta: string;
  emoji: string;
  barrio: string;
  coordenadas: { lng: number; lat: number };
}

interface PropuestaPayload {
  nombre: string;
  primerApellido: string;
  segundoApellido?: string;
  dni: string;
  emailCiudadano: string;
  barrio: string;
  elementos: ElementoPropuesta[];
  titulo: string;
  detalle: string;
  referencia: string;
}

function generarHtmlAyuntamiento(p: PropuestaPayload): string {
  const filaElementos = p.elementos.map(e => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;">${e.emoji} ${e.etiqueta}</td>
      <td style="padding:8px;border:1px solid #ddd;">${e.coordenadas.lat.toFixed(6)}, ${e.coordenadas.lng.toFixed(6)}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#2dd36f;padding:20px;border-radius:8px 8px 0 0;">
        <h1 style="color:white;margin:0;font-size:20px;">📬 Nueva propuesta ciudadana</h1>
        <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:14px;">Nº referencia: <strong>${p.referencia}</strong></p>
      </div>
      <div style="background:#f9f9f9;padding:20px;border:1px solid #eee;">
        <h2 style="font-size:15px;color:#333;margin:0 0 12px;">Datos del ciudadano</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#888;width:160px;">Nombre completo</td><td style="padding:6px 0;font-weight:600;">${p.nombre} ${p.primerApellido} ${p.segundoApellido ?? ''}</td></tr>
          <tr><td style="padding:6px 0;color:#888;">DNI/NIE</td><td style="padding:6px 0;font-weight:600;">${p.dni}</td></tr>
          <tr><td style="padding:6px 0;color:#888;">Email</td><td style="padding:6px 0;font-weight:600;">${p.emailCiudadano}</td></tr>
          <tr><td style="padding:6px 0;color:#888;">Barrio</td><td style="padding:6px 0;font-weight:600;">${p.barrio}</td></tr>
        </table>
      </div>
      <div style="background:white;padding:20px;border:1px solid #eee;border-top:none;">
        <h2 style="font-size:15px;color:#333;margin:0 0 8px;">📌 ${p.titulo}</h2>
        <p style="font-size:14px;color:#555;line-height:1.6;">${p.detalle}</p>
      </div>
      <div style="background:white;padding:20px;border:1px solid #eee;border-top:none;">
        <h2 style="font-size:15px;color:#333;margin:0 0 12px;">Elementos propuestos (${p.elementos.length})</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Elemento</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Coordenadas</th>
            </tr>
          </thead>
          <tbody>${filaElementos}</tbody>
        </table>
      </div>
      <div style="background:#f9f9f9;padding:14px 20px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">
        <p style="font-size:12px;color:#aaa;margin:0;">Enviado desde la app Vitoria Ciudadana · ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      </div>
    </div>
  `;
}

function generarHtmlCiudadano(p: PropuestaPayload): string {
  const listaElementos = p.elementos.map(e =>
    `<li style="padding:4px 0;">${e.emoji} ${e.etiqueta}</li>`
  ).join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#2dd36f;padding:20px;border-radius:8px 8px 0 0;">
        <h1 style="color:white;margin:0;font-size:20px;">✅ Tu propuesta ha sido enviada</h1>
      </div>
      <div style="background:white;padding:24px;border:1px solid #eee;">
        <p style="font-size:15px;color:#333;">Hola <strong>${p.nombre}</strong>,</p>
        <p style="font-size:14px;color:#555;line-height:1.6;">
          Tu propuesta para el barrio de <strong>${p.barrio}</strong> ha sido enviada correctamente al Ayuntamiento de Vitoria-Gasteiz.
        </p>
        <div style="background:#f0fff4;border-left:4px solid #2dd36f;padding:12px 16px;border-radius:4px;margin:16px 0;">
          <p style="margin:0;font-size:13px;color:#555;">Número de referencia</p>
          <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#2dd36f;letter-spacing:2px;">${p.referencia}</p>
        </div>
        <h3 style="font-size:14px;color:#333;margin:20px 0 8px;">Elementos incluidos en tu propuesta:</h3>
        <ul style="font-size:14px;color:#555;padding-left:20px;margin:0;">${listaElementos}</ul>
        <p style="font-size:13px;color:#888;margin-top:24px;line-height:1.6;">
          Guarda este número de referencia para hacer seguimiento de tu solicitud en el
          <a href="https://www.vitoria-gasteiz.org/wb021/was/areaAction.do?idioma=es&accion=inicio" style="color:#2dd36f;">Buzón Ciudadano</a>.
        </p>
      </div>
      <div style="background:#f9f9f9;padding:14px 20px;border:1px solid #eee;border-top:none;border-radius:0 0 8px 8px;">
        <p style="font-size:12px;color:#aaa;margin:0;">Vitoria Ciudadana · Ayuntamiento de Vitoria-Gasteiz</p>
      </div>
    </div>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const payload: PropuestaPayload = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Guardar en Supabase
    const { error: errorPropuesta } = await supabase
      .from('propuestas')
      .insert({
        referencia: payload.referencia,
        nombre: payload.nombre,
        primer_apellido: payload.primerApellido,
        segundo_apellido: payload.segundoApellido ?? null,
        dni: payload.dni,
        email: payload.emailCiudadano,
        barrio: payload.barrio,
        titulo: payload.titulo,
        detalle: payload.detalle,
        elementos: payload.elementos,
        num_elementos: payload.elementos.length,
      });

    if (errorPropuesta) {
      throw new Error(`Error guardando propuesta: ${errorPropuesta.message}`);
    }

    // 2. Email al ayuntamiento (en pruebas va a tu email)
    const resAyto = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [EMAIL_PRUEBAS], // producción: informacion@vitoria-gasteiz.org
        reply_to: payload.emailCiudadano,
        subject: `[Propuesta Ciudadana ${payload.referencia}] ${payload.titulo} · ${payload.barrio}`,
        html: generarHtmlAyuntamiento(payload),
      }),
    });

    if (!resAyto.ok) {
      const err = await resAyto.text();
      throw new Error(`Error enviando email al ayuntamiento: ${err}`);
    }

    // 3. Email de confirmación al ciudadano (en pruebas va a tu email)
    const resCiudadano = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [EMAIL_PRUEBAS], // producción: payload.emailCiudadano
        subject: `✅ Propuesta enviada · Ref. ${payload.referencia}`,
        html: generarHtmlCiudadano(payload),
      }),
    });

    if (!resCiudadano.ok) {
      const err = await resCiudadano.text();
      throw new Error(`Error enviando confirmación al ciudadano: ${err}`);
    }

    return new Response(
      JSON.stringify({ ok: true, referencia: payload.referencia }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});