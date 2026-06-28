import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerarTextoPayload {
  barrio: string;
  elementos: { etiqueta: string; emoji: string; coordenadas: { lat: number; lng: number } }[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const payload: GenerarTextoPayload = await req.json();

    const listaElementos = payload.elementos
      .map(e => `- ${e.emoji} ${e.etiqueta} (lat: ${e.coordenadas.lat.toFixed(4)}, lng: ${e.coordenadas.lng.toFixed(4)})`)
      .join('\n');

    const prompt = `Eres un asistente que ayuda a ciudadanos a redactar solicitudes formales al Ayuntamiento de Vitoria-Gasteiz.

Un ciudadano ha identificado los siguientes elementos que necesitan atención en el barrio de ${payload.barrio}:

${listaElementos}

Redacta en español, con tono formal y respetuoso:
1. Un TÍTULO conciso para el asunto (máximo 80 caracteres, sin punto final)
2. Una DESCRIPCIÓN detallada exponiendo la solicitud (3-4 frases, mencionando el barrio y los elementos concretos)

Responde ÚNICAMENTE en formato JSON con esta estructura exacta, sin texto adicional ni comillas de código:
{"titulo":"...","descripcion":"..."}`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Error Groq API: ${err}`);
    }

    const data = await res.json();
    const texto = data.choices[0].message.content.trim();

    // Limpia posibles backticks
    const textoLimpio = texto.replace(/```json|```/g, '').trim();
    const json = JSON.parse(textoLimpio);

    return new Response(
      JSON.stringify({ ok: true, titulo: json.titulo, descripcion: json.descripcion }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});