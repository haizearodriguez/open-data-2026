import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

const MAX_ELEMENTOS = 20;
const MAX_BARRIO = 100;
const MAX_ETIQUETA = 100;

interface ElementoGenerarTexto {
  etiqueta: string;
  emoji: string;
  coordenadas: {
    lat: number;
    lng: number;
  };
}

interface GenerarTextoPayload {
  barrio: string;
  elementos: ElementoGenerarTexto[];
}

interface RespuestaIA {
  titulo: string;
  descripcion: string;
}

function respuestaJson(
  body: unknown,
  status = 200
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    }
  );
}

function textoValido(
  valor: unknown,
  minimo: number,
  maximo: number
): valor is string {
  return (
    typeof valor === 'string' &&
    valor.trim().length >= minimo &&
    valor.trim().length <= maximo
  );
}

function coordenadasValidas(
  coordenadas: unknown
): boolean {

  if (
    typeof coordenadas !== 'object' ||
    coordenadas === null
  ) {
    return false;
  }

  const c = coordenadas as {
    lat?: unknown;
    lng?: unknown;
  };

  return (
    typeof c.lat === 'number' &&
    Number.isFinite(c.lat) &&
    c.lat >= -90 &&
    c.lat <= 90 &&
    typeof c.lng === 'number' &&
    Number.isFinite(c.lng) &&
    c.lng >= -180 &&
    c.lng <= 180
  );
}

function validarPayload(
  payload: unknown
): string[] {

  const errores: string[] = [];

  if (
    typeof payload !== 'object' ||
    payload === null
  ) {
    return [
      'El cuerpo de la petición no es válido.',
    ];
  }

  const p =
    payload as Partial<GenerarTextoPayload>;

  // ----------------------------------------------
  // Barrio
  // ----------------------------------------------

  if (
    !textoValido(
      p.barrio,
      2,
      MAX_BARRIO
    )
  ) {
    errores.push(
      'El barrio no es válido.'
    );
  }

  // ----------------------------------------------
  // Elementos
  // ----------------------------------------------

  if (!Array.isArray(p.elementos)) {

    errores.push(
      'Los elementos no son válidos.'
    );

    return errores;
  }

  if (
    p.elementos.length < 1 ||
    p.elementos.length > MAX_ELEMENTOS
  ) {

    errores.push(
      `Debe haber entre 1 y ${MAX_ELEMENTOS} elementos.`
    );

    return errores;
  }

  p.elementos.forEach(
    (elemento, index) => {

      const numero =
        index + 1;

      if (
        typeof elemento !== 'object' ||
        elemento === null
      ) {
        errores.push(
          `El elemento ${numero} no es válido.`
        );

        return;
      }

      if (
        !textoValido(
          elemento.etiqueta,
          1,
          MAX_ETIQUETA
        )
      ) {
        errores.push(
          `La etiqueta del elemento ${numero} no es válida.`
        );
      }

      if (
        typeof elemento.emoji !== 'string' ||
        elemento.emoji.length > 20
      ) {
        errores.push(
          `El emoji del elemento ${numero} no es válido.`
        );
      }

      if (
        !coordenadasValidas(
          elemento.coordenadas
        )
      ) {
        errores.push(
          `Las coordenadas del elemento ${numero} no son válidas.`
        );
      }
    }
  );

  return errores;
}

function respuestaIAValida(
  valor: unknown
): valor is RespuestaIA {

  if (
    typeof valor !== 'object' ||
    valor === null
  ) {
    return false;
  }

  const respuesta =
    valor as {
      titulo?: unknown;
      descripcion?: unknown;
    };

  return (
    typeof respuesta.titulo === 'string' &&
    respuesta.titulo.trim().length >= 5 &&
    respuesta.titulo.trim().length <= 80 &&
    typeof respuesta.descripcion === 'string' &&
    respuesta.descripcion.trim().length >= 10 &&
    respuesta.descripcion.trim().length <= 5000
  );
}

serve(async (req) => {

  // --------------------------------------------------
  // CORS
  // --------------------------------------------------

  if (req.method === 'OPTIONS') {

    return new Response(
      'ok',
      {
        headers: CORS_HEADERS,
      }
    );
  }

  // --------------------------------------------------
  // Solo POST
  // --------------------------------------------------

  if (req.method !== 'POST') {

    return respuestaJson(
      {
        ok: false,
        error: 'Método no permitido.',
      },
      405
    );
  }

  // --------------------------------------------------
  // Comprobar API key
  // --------------------------------------------------

  if (!GROQ_API_KEY) {

    console.error(
      'GROQ_API_KEY no está configurada.'
    );

    return respuestaJson(
      {
        ok: false,
        error:
          'El servicio de IA no está configurado correctamente.',
      },
      500
    );
  }

  try {

    // ------------------------------------------------
    // Leer JSON
    // ------------------------------------------------

    let payload: unknown;

    try {

      payload = await req.json();

    } catch {

      return respuestaJson(
        {
          ok: false,
          error:
            'El cuerpo de la petición no contiene JSON válido.',
        },
        400
      );
    }

    // ------------------------------------------------
    // Validación
    // ------------------------------------------------

    const errores =
      validarPayload(payload);

    if (errores.length > 0) {

      return respuestaJson(
        {
          ok: false,
          error:
            'Datos no válidos.',
          detalles:
            errores,
        },
        400
      );
    }

    const propuesta =
      payload as GenerarTextoPayload;

    // ------------------------------------------------
    // Preparar elementos
    // ------------------------------------------------

    const listaElementos =
      propuesta.elementos
        .map(
          (e, index) =>
            `${index + 1}. ${e.emoji} ${e.etiqueta} ` +
            `(lat: ${e.coordenadas.lat.toFixed(4)}, ` +
            `lng: ${e.coordenadas.lng.toFixed(4)})`
        )
        .join('\n');

    const barrio =
      propuesta.barrio.trim();

    // ------------------------------------------------
    // Prompt
    // ------------------------------------------------

    const prompt = `
Eres un asistente que ayuda a ciudadanos a redactar
solicitudes formales al Ayuntamiento de Vitoria-Gasteiz.

Tu tarea es transformar los datos proporcionados en
un texto administrativo claro, concreto y respetuoso.

DATOS DEL CIUDADANO:

Barrio:
${barrio}

Elementos identificados:
${listaElementos}

INSTRUCCIONES:

1. Genera un título conciso de máximo 80 caracteres.
2. Genera una descripción de 3-4 frases.
3. La descripción debe mencionar el barrio.
4. Debe mencionar los elementos identificados.
5. No inventes problemas, daños, fechas, personas,
   actuaciones realizadas ni circunstancias que no
   aparezcan en los datos.
6. No incluyas coordenadas en el título.
7. Utiliza español.
8. Utiliza un tono formal y respetuoso.
9. No incluyas saludos ni despedidas.
10. Devuelve únicamente un objeto JSON válido con
    las propiedades "titulo" y "descripcion".
`;

    // ------------------------------------------------
    // Petición a Groq
    // ------------------------------------------------

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => controller.abort(),
        20_000
      );

    let res: Response;

    try {

      res = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',

          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },

          signal: controller.signal,

          body: JSON.stringify({
            model: 'openai/gpt-oss-20b',

            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],

            max_completion_tokens: 300,

            temperature: 0.3,

            include_reasoning: false,


            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'propuesta',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    titulo: {
                      type: 'string',
                    },
                    descripcion: {
                      type: 'string',
                    },
                  },
                  required: [
                    'titulo',
                    'descripcion',
                  ],
                  additionalProperties: false,
                },
              },
            },
          }),
        }
      );

    } finally {

      clearTimeout(timeout);
    }

    // ------------------------------------------------
    // Error Groq
    // ------------------------------------------------

    if (!res.ok) {

      const errorText = await res.text();

      console.error(
        'ERROR GROQ:',
        res.status,
        errorText
      );

      let detalleGroq = 'Error desconocido de Groq.';

      try {
        const errorJson = JSON.parse(errorText);

        detalleGroq =
          errorJson?.error?.message ??
          errorJson?.message ??
          errorText;
      } catch {
        detalleGroq = errorText;
      }

      return respuestaJson(
        {
          ok: false,
          error: 'Error en Groq.',
          detalle: detalleGroq,
          codigo: res.status,
        },
        502
      );
    }

    // ------------------------------------------------
    // Leer respuesta
    // ------------------------------------------------

    const data =
      await res.json();

    const contenido =
      data?.choices?.[0]?.message?.content;

    if (
      typeof contenido !== 'string' ||
      !contenido.trim()
    ) {

      console.error(
        'Respuesta Groq inesperada:',
        JSON.stringify(data)
      );

      return respuestaJson(
        {
          ok: false,
          error:
            'La IA no devolvió un resultado válido.',
        },
        502
      );
    }

    // ------------------------------------------------
    // Parsear JSON
    // ------------------------------------------------

    let resultado: unknown;

    try {

      resultado =
        JSON.parse(
          contenido.trim()
        );

    } catch (error) {

      console.error(
        'JSON generado por Groq no válido:',
        contenido,
        error
      );

      return respuestaJson(
        {
          ok: false,
          error:
            'La IA devolvió un formato no válido.',
        },
        502
      );
    }

    // ------------------------------------------------
    // Validar respuesta
    // ------------------------------------------------

    if (
      !respuestaIAValida(resultado)
    ) {

      console.error(
        'Respuesta IA no válida:',
        resultado
      );

      return respuestaJson(
        {
          ok: false,
          error:
            'La IA devolvió datos incompletos o no válidos.',
        },
        502
      );
    }

    // ------------------------------------------------
    // Normalizar resultado
    // ------------------------------------------------

    const titulo =
      resultado.titulo.trim();

    const descripcion =
      resultado.descripcion.trim();

    // ------------------------------------------------
    // Respuesta final
    // ------------------------------------------------

    return respuestaJson({
      ok: true,
      titulo,
      descripcion,
    });

  } catch (error) {

    console.error(
      'Error en generar-texto:',
      error
    );

    if (
      error instanceof DOMException &&
      error.name === 'AbortError'
    ) {

      return respuestaJson(
        {
          ok: false,
          error:
            'La generación de texto ha tardado demasiado. Inténtalo de nuevo.',
        },
        504
      );
    }

    return respuestaJson(
      {
        ok: false,
        error:
          'No se pudo generar el texto. Inténtalo de nuevo.',
      },
      500
    );
  }
});