export const CATEGORIAS_VALIDAS = [
  'desperfecto',
  'fuente',
  'zona-verde',
  'mobiliario',
  'alumbrado',
  'accesibilidad',
  'otros-via',
  'limpieza',
  'reciclaje',
  'otros-medioambiente',
] as const;

export interface ElementoPropuesta {
  tipo: string;
  etiqueta: string;
  emoji: string;
  barrio: string;
  coordenadas: {
    lng: number;
    lat: number;
  };
}

export interface PropuestaPayload {
  nombre: string;
  primerApellido: string;
  segundoApellido?: string;
  dni: string;
  emailCiudadano: string;
  barrio: string;
  elementos: ElementoPropuesta[];
  titulo: string;
  detalle: string;
  referencia?: string;
}

function textoValido(
  valor: unknown,
  minimo: number,
  maximo: number
): boolean {
  return (
    typeof valor === 'string' &&
    valor.trim().length >= minimo &&
    valor.trim().length <= maximo
  );
}

export function validarEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email.trim()
  );
}

export function validarDniNie(dni: string): boolean {
  const valor = dni.trim().toUpperCase();

  if (!/^[0-9XYZ][0-9]{7}[A-Z]$/.test(valor)) {
    return false;
  }

  let numero = valor;

  if (valor.startsWith('X')) {
    numero = '0' + valor.substring(1);
  } else if (valor.startsWith('Y')) {
    numero = '1' + valor.substring(1);
  } else if (valor.startsWith('Z')) {
    numero = '2' + valor.substring(1);
  }

  const letras =
    'TRWAGMYFPDXBNJZSQVHLCKE';

  const numeroDni = parseInt(
    numero.substring(0, 8),
    10
  );

  const letra = numero.charAt(8);

  return letras[numeroDni % 23] === letra;
}

export function validarCoordenadas(
  coordenadas: unknown
): boolean {
  if (
    typeof coordenadas !== 'object' ||
    coordenadas === null
  ) {
    return false;
  }

  const coords = coordenadas as {
    lng?: unknown;
    lat?: unknown;
  };

  return (
    typeof coords.lng === 'number' &&
    Number.isFinite(coords.lng) &&
    coords.lng >= -180 &&
    coords.lng <= 180 &&
    typeof coords.lat === 'number' &&
    Number.isFinite(coords.lat) &&
    coords.lat >= -90 &&
    coords.lat <= 90
  );
}

export function validarPropuesta(
  payload: unknown
): string[] {
  const errores: string[] = [];

  // --------------------------------------------------
  // Estructura básica de la petición
  // --------------------------------------------------

  if (
    typeof payload !== 'object' ||
    payload === null
  ) {
    return [
      'El cuerpo de la petición no es válido.'
    ];
  }

  const p =
    payload as Partial<PropuestaPayload>;

  // --------------------------------------------------
  // Datos personales
  // --------------------------------------------------

  if (!textoValido(p.nombre, 2, 100)) {
    errores.push(
      'El nombre debe tener entre 2 y 100 caracteres.'
    );
  }

  if (!textoValido(p.primerApellido, 2, 100)) {
    errores.push(
      'El primer apellido debe tener entre 2 y 100 caracteres.'
    );
  }

  if (
    p.segundoApellido !== undefined &&
    !textoValido(
      p.segundoApellido,
      2,
      100
    )
  ) {
    errores.push(
      'El segundo apellido debe tener entre 2 y 100 caracteres.'
    );
  }

  // --------------------------------------------------
  // DNI / NIE
  // --------------------------------------------------

  if (
    typeof p.dni !== 'string' ||
    !validarDniNie(p.dni)
  ) {
    errores.push(
      'El DNI/NIE no tiene un formato válido.'
    );
  }

  // --------------------------------------------------
  // Email
  // --------------------------------------------------

  if (
    typeof p.emailCiudadano !== 'string' ||
    !validarEmail(p.emailCiudadano)
  ) {
    errores.push(
      'El email no tiene un formato válido.'
    );
  }

  // --------------------------------------------------
  // Barrio
  // --------------------------------------------------

  if (!textoValido(p.barrio, 2, 100)) {
    errores.push(
      'El barrio debe tener entre 2 y 100 caracteres.'
    );
  }

  // --------------------------------------------------
  // Título
  // --------------------------------------------------

  if (!textoValido(p.titulo, 5, 200)) {
    errores.push(
      'El título debe tener entre 5 y 200 caracteres.'
    );
  }

  // --------------------------------------------------
  // Descripción
  // --------------------------------------------------

  if (!textoValido(p.detalle, 10, 5000)) {
    errores.push(
      'La descripción debe tener entre 10 y 5000 caracteres.'
    );
  }

  // --------------------------------------------------
  // Elementos
  // --------------------------------------------------

  if (
    !Array.isArray(p.elementos) ||
    p.elementos.length < 1 ||
    p.elementos.length > 100
  ) {
    errores.push(
      'La propuesta debe contener entre 1 y 100 elementos.'
    );
  } else {

    p.elementos.forEach(
      (elemento, index) => {

        const numeroElemento =
          index + 1;

        // --------------------------------------------
        // Objeto
        // --------------------------------------------

        if (
          !elemento ||
          typeof elemento !== 'object'
        ) {
          errores.push(
            `El elemento ${numeroElemento} no es válido.`
          );

          return;
        }

        // --------------------------------------------
        // Tipo
        // --------------------------------------------

        if (
          !CATEGORIAS_VALIDAS.includes(
            elemento.tipo as
              typeof CATEGORIAS_VALIDAS[number]
          )
        ) {
          errores.push(
            `El tipo del elemento ${numeroElemento} no es válido.`
          );
        }

        // --------------------------------------------
        // Etiqueta
        // --------------------------------------------

        if (
          !textoValido(
            elemento.etiqueta,
            1,
            200
          )
        ) {
          errores.push(
            `La etiqueta del elemento ${numeroElemento} debe tener entre 1 y 200 caracteres.`
          );
        }

        // --------------------------------------------
        // Barrio del elemento
        // --------------------------------------------

        if (
          !textoValido(
            elemento.barrio,
            2,
            100
          )
        ) {
          errores.push(
            `El barrio del elemento ${numeroElemento} debe tener entre 2 y 100 caracteres.`
          );
        }

        // --------------------------------------------
        // Coordenadas
        // --------------------------------------------

        if (
          !validarCoordenadas(
            elemento.coordenadas
          )
        ) {
          errores.push(
            `Las coordenadas del elemento ${numeroElemento} no son válidas.`
          );
        }
      }
    );
  }

  return errores;
}