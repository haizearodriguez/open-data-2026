/// <reference lib="deno.ns" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

const CATEGORIAS = [
  {
    tipo: 'desperfecto',
    etiqueta: 'Desperfectos en vía pública',
    emoji: '🚧',
  },
  {
    tipo: 'obras',
    etiqueta: 'Obras en vía pública',
    emoji: '🏗️',
  },
  {
    tipo: 'ocupacion',
    etiqueta: 'Ocupación de la vía pública',
    emoji: '🪧',
  },
  {
    tipo: 'zona-verde',
    etiqueta: 'Zonas verdes',
    emoji: '🌳',
  },
  {
    tipo: 'mobiliario',
    etiqueta: 'Mobiliario urbano',
    emoji: '🪑',
  },
  {
    tipo: 'alumbrado',
    etiqueta: 'Alumbrado público',
    emoji: '💡',
  },
  {
    tipo: 'accesibilidad',
    etiqueta: 'Accesibilidad',
    emoji: '♿',
  },
  {
    tipo: 'otros-via',
    etiqueta: 'Otros vía pública',
    emoji: '📋',
  },
  {
    tipo: 'limpieza',
    etiqueta: 'Limpieza pública',
    emoji: '🧹',
  },
  {
    tipo: 'reciclaje',
    etiqueta: 'Reciclaje de residuos',
    emoji: '♻️',
  },
  {
    tipo: 'otros-medioambiente',
    etiqueta: 'Otros medio ambiente',
    emoji: '🌿',
  },
];

interface ResultadoIA {
  tipo: string;
  titulo: string;
  descripcion: string;
}

function respuestaJson(
  data: unknown,
  status = 200
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Intenta extraer un objeto JSON de la respuesta del modelo.
 *
 * Aunque usamos response_format=json_object,
 * mantenemos este parser como protección adicional.
 */
function extraerJson(texto: string): ResultadoIA {

  let limpio = texto.trim();

  limpio = limpio
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();


  limpio = limpio
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(limpio) as ResultadoIA;
  } catch {
    // Continuamos buscando el objeto JSON.
  }


  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');

  if (
    inicio === -1 ||
    fin === -1 ||
    fin <= inicio
  ) {
    throw new Error(
      `La IA no devolvió un JSON válido. Respuesta: ${limpio.substring(0, 1000)}`
    );
  }

  const posibleJson =
    limpio.substring(
      inicio,
      fin + 1
    );

  try {

    return JSON.parse(
      posibleJson
    ) as ResultadoIA;

  } catch {

    throw new Error(
      `La IA devolvió un JSON incorrecto. Respuesta: ${limpio.substring(0, 1000)}`
    );
  }
}

  serve(async (req) => {


  if (req.method === 'OPTIONS') {
    return new Response(
      'ok',
      {
        headers: CORS_HEADERS,
      }
    );
  }



  if (req.method !== 'POST') {
    return respuestaJson(
      {
        ok: false,
        error: 'Método no permitido.',
      },
      405
    );
  }

  try {

 
    if (!GROQ_API_KEY) {



      return respuestaJson(
        {
          ok: false,
          error:
            'El servicio de IA no está configurado.',
        },
        500
      );
    }



    let payload: {
      imagenBase64?: string;
      barrio?: string;
    };

    try {

      payload =
        await req.json();

    } catch {

      return respuestaJson(
        {
          ok: false,
          error:
            'El cuerpo de la petición no es JSON válido.',
        },
        400
      );
    }

    const imagenBase64 =
      payload?.imagenBase64;

    const barrio =
      payload?.barrio;

    if (
      typeof imagenBase64 !== 'string' ||
      !imagenBase64.trim()
    ) {

      return respuestaJson(
        {
          ok: false,
          error:
            'No se recibió ninguna imagen.',
        },
        400
      );
    }



    const categoriasTexto =
      CATEGORIAS
        .map(
          c =>
            `- ${c.tipo}: ${c.etiqueta}`
        )
        .join('\n');


    const prompt = `
Eres un asistente de gestión urbana para el Ayuntamiento de Vitoria-Gasteiz.

Analiza cuidadosamente esta imagen de una posible incidencia urbana${
      barrio
        ? ` en el barrio de ${barrio}`
        : ''
    }.

Identifica el problema visible y clasifícalo utilizando EXCLUSIVAMENTE una de estas categorías:

${categoriasTexto}

REGLAS IMPORTANTES:

- El campo "tipo" debe ser EXACTAMENTE uno de los identificadores anteriores.
- No inventes categorías.
- "desperfecto" se utiliza para pavimento roto, baldosas levantadas, agujeros, grietas, tapas o elementos de la vía pública en mal estado.
- "obras" se utiliza cuando se observan obras, trabajos o actuaciones en curso.
- "ocupacion" se utiliza cuando algo ocupa indebidamente la vía pública.
- "zona-verde" se utiliza para problemas relacionados con parques, jardines, árboles o zonas verdes.
- "mobiliario" se utiliza para bancos, papeleras, señales, barandillas u otro mobiliario urbano deteriorado.
- "alumbrado" se utiliza para farolas, luminarias o problemas de iluminación.
- "accesibilidad" se utiliza cuando el problema afecta principalmente a rampas, pasos accesibles, barreras u otros elementos de accesibilidad.
- "limpieza" se utiliza para suciedad, residuos o falta de limpieza.
- "reciclaje" se utiliza para contenedores o problemas relacionados con reciclaje.
- Si no puedes determinar claramente el problema, utiliza "desperfecto".

El título debe:
- Ser formal.
- Ser claro.
- Tener como máximo 80 caracteres.
- No terminar en punto.

La descripción debe:
- Tener 2 o 3 frases.
- Ser formal y adecuada para una comunicación al Ayuntamiento.
- Describir únicamente lo que pueda observarse razonablemente en la imagen.
- No inventar datos que no aparecen en la imagen.

Responde ÚNICAMENTE con un objeto JSON válido.

La estructura debe ser EXACTAMENTE:

{
  "tipo": "identificador de categoría",
  "titulo": "título de la incidencia",
  "descripcion": "descripción formal de la incidencia"
}

No escribas explicaciones.
No utilices Markdown.
No utilices bloques de código.
`.trim();


    const imagenUrl =
      `data:image/jpeg;base64,${imagenBase64}`;




    const res =
      await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',

          headers: {
            'Authorization':
              `Bearer ${GROQ_API_KEY}`,

            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({

            // Modelo disponible en tu proyecto
            model:
              'qwen/qwen3.6-27b',

            messages: [
              {
                role: 'user',

                content: [
                  {
                    type: 'image_url',

                    image_url: {
                      url: imagenUrl,
                    },
                  },

                  {
                    type: 'text',
                    text: prompt,
                  },
                ],
              },
            ],

            // ------------------------------------------------
            // Importante:
            // desactivamos el razonamiento para evitar que
            // consuma los tokens antes de producir el JSON.
            // ------------------------------------------------

            reasoning_effort: 'none',


            response_format: {
              type: 'json_object',
            },

            max_completion_tokens: 500,

            temperature: 0.2,
          }),
        }
      );



    if (!res.ok) {

      const detalle =
        await res.text();


      return respuestaJson(
        {
          ok: false,
          error: 'Error en Groq.',
          codigo: res.status,
          detalle,
        },
        502
      );
    }


    const data =
      await res.json();

    const texto =
      data?.choices?.[0]?.message?.content;



    if (
      typeof texto !== 'string' ||
      !texto.trim()
    ) {



      return respuestaJson(
        {
          ok: false,
          error:
            'Groq no devolvió una respuesta válida.',
          detalle:
            JSON.stringify(data)
              .substring(0, 1000),
        },
        502
      );
    }


    let resultado: ResultadoIA;

    try {

      resultado =
        extraerJson(texto);

    } catch (error) {



      return respuestaJson(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'La IA no devolvió un JSON válido.',
          respuestaIA:
            texto.substring(0, 1000),
        },
        502
      );
    }


    if (
      typeof resultado.tipo !== 'string' ||
      typeof resultado.titulo !== 'string' ||
      typeof resultado.descripcion !== 'string'
    ) {



      return respuestaJson(
        {
          ok: false,
          error:
            'La IA devolvió una respuesta incompleta.',
          respuestaIA:
            JSON.stringify(resultado)
              .substring(0, 1000),
        },
        502
      );
    }


    const categoria =
      CATEGORIAS.find(
        c =>
          c.tipo ===
          resultado.tipo.trim()
      );

    if (!categoria) {



      return respuestaJson(
        {
          ok: false,
          error:
            'La IA devolvió una categoría no válida.',
          tipoRecibido:
            resultado.tipo,
        },
        502
      );
    }


    const titulo =
      resultado.titulo
        .trim()
        .substring(0, 80);



    const descripcion =
      resultado.descripcion
        .trim()
        .substring(0, 1000);

    if (!titulo || !descripcion) {

      return respuestaJson(
        {
          ok: false,
          error:
            'La IA no generó correctamente el título o la descripción.',
        },
        502
      );
    }



    return respuestaJson({
      ok: true,

      tipo:
        categoria.tipo,

      etiqueta:
        categoria.etiqueta,

      emoji:
        categoria.emoji,

      titulo,

      descripcion,
    });

  } catch (error) {



    return respuestaJson(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Error interno del servidor.',
      },
      500
    );
  }
});