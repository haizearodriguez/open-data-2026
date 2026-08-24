/**
 * Traduce un par coordenado UTM (X, Y) Huso 30N
 * a coordenadas geográficas WGS84 (Lng, Lat).
 */
export function convertirCoordenadaUtmAWgs84(
  x: number,
  y: number
): [number, number] {

  const lonCentral = -3.0;

  const a = 6378137.0;

  const fMod =
    1 / 298.257223563;

  const b =
    a * (1 - fMod);

  const e2 =
    (
      Math.pow(a, 2) -
      Math.pow(b, 2)
    ) /
    Math.pow(a, 2);

  const ePrime2 =
    (
      Math.pow(a, 2) -
      Math.pow(b, 2)
    ) /
    Math.pow(b, 2);

  const utmX =
    x - 500000;

  const utmY =
    y;

  const M =
    utmY / 0.9996;

  const mu =
    M /
    (
      a *
      (
        1 -
        e2 / 4 -
        3 * e2 * e2 / 64 -
        5 * e2 * e2 * e2 / 256
      )
    );

  const e1 =
    (
      1 -
      Math.sqrt(1 - e2)
    ) /
    (
      1 +
      Math.sqrt(1 - e2)
    );

  const J1 =
    3 * e1 / 2 -
    27 * Math.pow(e1, 3) / 32;

  const J2 =
    21 * Math.pow(e1, 2) / 16 -
    55 * Math.pow(e1, 4) / 32;

  const J3 =
    151 * Math.pow(e1, 3) / 96;

  const fp =
    mu +
    J1 * Math.sin(2 * mu) +
    J2 * Math.sin(4 * mu) +
    J3 * Math.sin(6 * mu);

  const C1 =
    ePrime2 *
    Math.pow(Math.cos(fp), 2);

  const T1 =
    Math.pow(Math.tan(fp), 2);

  const R1 =
    a *
    (1 - e2) /
    Math.pow(
      1 -
      e2 *
      Math.pow(Math.sin(fp), 2),
      1.5
    );

  const N1 =
    a /
    Math.sqrt(
      1 -
      e2 *
      Math.pow(Math.sin(fp), 2)
    );

  const D =
    utmX /
    (N1 * 0.9996);

  let lat =
    fp -
    (
      N1 *
      Math.tan(fp) /
      R1
    ) *
    (
      Math.pow(D, 2) / 2 -

      (
        5 +
        3 * T1 +
        10 * C1 -
        4 * Math.pow(C1, 2) -
        9 * ePrime2
      ) *
      Math.pow(D, 4) / 24
    );

  let lng =
    (
      D -

      (
        1 +
        2 * T1 +
        C1
      ) *
      Math.pow(D, 3) / 6 +

      (
        5 -
        2 * C1 +
        28 * T1 -
        3 * Math.pow(C1, 2) +
        8 * ePrime2 +
        24 * Math.pow(T1, 2)
      ) *
      Math.pow(D, 5) / 120
    ) /
    Math.cos(fp);

  lat =
    lat *
    (180 / Math.PI);

  lng =
    (
      lng *
      (180 / Math.PI)
    ) +
    lonCentral;

  return [
    lng,
    lat
  ];
}


/**
 * Convierte un GeoJSON de PUNTOS
 * de UTM a WGS84.
 */
export function convertirGeoJsonUtmAWgs84(
  geojson: any
): any {

  if (
    !geojson ||
    !geojson.features
  ) {
    return geojson;
  }

  const featuresCorregidas =
    geojson.features
      .map((f: any) => {

        if (
          !f.geometry ||
          !f.geometry.coordinates
        ) {
          return null;
        }

        const x =
          f.geometry.coordinates[0];

        const y =
          f.geometry.coordinates[1];

        if (
          !x ||
          !y ||
          isNaN(x) ||
          isNaN(y)
        ) {
          return null;
        }

        const [
          lng,
          lat
        ] =
          convertirCoordenadaUtmAWgs84(
            x,
            y
          );

        return {
          ...f,

          geometry: {
            type: 'Point',
            coordinates: [
              lng,
              lat
            ]
          }
        };
      })
      .filter(
        (f: any) =>
          f !== null
      );

  return {
    type: 'FeatureCollection',
    features:
      featuresCorregidas
  };
}


/**
 * Comprueba si una coordenada [x, y]
 * se encuentra dentro de un polígono.
 *
 * Las coordenadas deben estar en el MISMO
 * sistema de referencia.
 */
export function esPuntoEnPoligono(
  punto: [number, number],
  poligono: [number, number][][]
): boolean {

  const x =
    punto[0];

  const y =
    punto[1];

  let dentro =
    false;

  const anillo =
    poligono[0];

  if (
    !anillo ||
    anillo.length < 3
  ) {
    return false;
  }

  for (
    let i = 0,
    j = anillo.length - 1;

    i < anillo.length;

    j = i++
  ) {

    const xi =
      anillo[i][0];

    const yi =
      anillo[i][1];

    const xj =
      anillo[j][0];

    const yj =
      anillo[j][1];

    const intersecta =
      (
        (yi > y) !==
        (yj > y)
      ) &&
      (
        x <
        (
          (xj - xi) *
          (y - yi) /
          (yj - yi)
        ) +
        xi
      );

    if (intersecta) {
      dentro =
        !dentro;
    }
  }

  return dentro;
}


/**
 * Calcula el Bounding Box
 * [[Oeste, Sur], [Este, Norte]]
 * de un anillo WGS84.
 */
export function obtenerBoundsDePoligono(
  poligono: [number, number][][]
): [
  [number, number],
  [number, number]
] {

  const anillo =
    poligono[0];

  let minLng =
    Infinity;

  let minLat =
    Infinity;

  let maxLng =
    -Infinity;

  let maxLat =
    -Infinity;

  for (
    const [lng, lat]
    of anillo
  ) {

    if (
      lng < minLng
    ) {
      minLng =
        lng;
    }

    if (
      lat < minLat
    ) {
      minLat =
        lat;
    }

    if (
      lng > maxLng
    ) {
      maxLng =
        lng;
    }

    if (
      lat > maxLat
    ) {
      maxLat =
        lat;
    }
  }

  return [
    [
      minLng,
      minLat
    ],
    [
      maxLng,
      maxLat
    ]
  ];
}


/**
 * Convierte coordenadas WGS84 (GPS)
 * a ETRS89 / UTM 30N (EPSG:25830).
 *
 * Entrada:
 *   lng = longitud
 *   lat = latitud
 *
 * Salida:
 *   [X, Y] en metros.
 */
export function convertirWgs84AUtm30(
  lng: number,
  lat: number
): [number, number] {

  const a =
    6378137.0;

  const f =
    1 / 298.257222101;

  const e2 =
    2 * f - f * f;

  const ePrime2 =
    e2 / (1 - e2);

  const k0 =
    0.9996;

  // Meridiano central del huso 30
  const lonCentral =
    -3 * Math.PI / 180;

  const latRad =
    lat * Math.PI / 180;

  const lonRad =
    lng * Math.PI / 180;

  const sinLat =
    Math.sin(latRad);

  const cosLat =
    Math.cos(latRad);

  const tanLat =
    Math.tan(latRad);

  const N =
    a /
    Math.sqrt(
      1 -
      e2 *
      sinLat *
      sinLat
    );

  const T =
    tanLat *
    tanLat;

  const C =
    ePrime2 *
    cosLat *
    cosLat;

  const A =
    cosLat *
    (
      lonRad -
      lonCentral
    );

  const M =
    a *
    (
      (
        1 -
        e2 / 4 -
        3 * Math.pow(e2, 2) / 64 -
        5 * Math.pow(e2, 3) / 256
      ) *
      latRad

      -

      (
        3 * e2 / 8 +
        3 * Math.pow(e2, 2) / 32 +
        45 * Math.pow(e2, 3) / 1024
      ) *
      Math.sin(
        2 * latRad
      )

      +

      (
        15 * Math.pow(e2, 2) / 256 +
        45 * Math.pow(e2, 3) / 1024
      ) *
      Math.sin(
        4 * latRad
      )

      -

      (
        35 * Math.pow(e2, 3) / 3072
      ) *
      Math.sin(
        6 * latRad
      )
    );

  const x =
    500000 +
    k0 *
    N *
    (
      A +

      (
        1 -
        T +
        C
      ) *
      Math.pow(A, 3) / 6 +

      (
        5 -
        18 * T +
        T * T +
        72 * C -
        58 * ePrime2
      ) *
      Math.pow(A, 5) / 120
    );

  const y =
    k0 *
    (
      M +

      N *
      tanLat *
      (
        Math.pow(A, 2) / 2 +

        (
          5 -
          T +
          9 * C +
          4 * C * C
        ) *
        Math.pow(A, 4) / 24 +

        (
          61 -
          58 * T +
          T * T +
          600 * C -
          330 * ePrime2
        ) *
        Math.pow(A, 6) / 720
      )
    );

  return [
    x,
    y
  ];
}