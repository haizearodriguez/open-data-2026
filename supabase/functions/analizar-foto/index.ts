import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CATEGORIAS = [
  { tipo: 'desperfecto',         etiqueta: 'Desperfectos en vía pública', emoji: '🚧' },
  { tipo: 'obras',               etiqueta: 'Obras en vía pública',        emoji: '🏗️' },
  { tipo: 'ocupacion',           etiqueta: 'Ocupación de la vía pública', emoji: '🪧' },
  { tipo: 'zona-verde',          etiqueta: 'Zonas verdes',                emoji: '🌳' },
  { tipo: 'mobiliario',          etiqueta: 'Mobiliario urbano',           emoji: '🪑' },
  { tipo: 'alumbrado',           etiqueta: 'Alumbrado público',           emoji: '💡' },
  { tipo: 'accesibilidad',       etiqueta: 'Accesibilidad',               emoji: '♿' },
  { tipo: 'otros-via',           etiqueta: 'Otros vía pública',           emoji: '📋' },
  { tipo: 'limpieza',            etiqueta: 'Limpieza pública',            emoji: '🧹' },
  { tipo: 'reciclaje',           etiqueta: 'Reciclaje de residuos',       emoji: '♻️' },
  { tipo: 'otros-medioambiente', etiqueta: 'Otros medio ambiente',        emoji: '🌿' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { imagenBase64, barrio } = await req.json();
    if (!imagenBase64) throw new Error('No se recibió imagen');

    const categoriasTexto = CATEGORIAS.map(c => `- ${c.tipo}: ${c.etiqueta}`).join('\n');

    const prompt = `Eres un asistente de gestión urbana para el Ayuntamiento de Vitoria-Gasteiz.

Analiza esta imagen de una incidencia urbana${barrio ? ` en el barrio de ${barrio}` : ''} e identifica el problema.

Categorías disponibles:
${categoriasTexto}

Responde ÚNICAMENTE en formato JSON sin texto adicional ni comillas de código:
{"tipo":"el tipo exacto de la lista","titulo":"título formal conciso (máx 80 caracteres)","descripcion":"descripción formal de 2-3 frases para el ayuntamiento"}`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imagenBase64}` }
              },
              { type: 'text', text: prompt }
            ]
          }
        ],
        max_tokens: 400,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Error Groq API: ${err}`);
    }

    const data = await res.json();
    const texto = data.choices[0].message.content.trim();
    const textoLimpio = texto.replace(/```json|```/g, '').trim();
    const json = JSON.parse(textoLimpio);

    const categoria = CATEGORIAS.find(c => c.tipo === json.tipo) ?? CATEGORIAS[0];

    return new Response(
      JSON.stringify({
        ok: true,
        tipo: categoria.tipo,
        etiqueta: categoria.etiqueta,
        emoji: categoria.emoji,
        titulo: json.titulo,
        descripcion: json.descripcion,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});