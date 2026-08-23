import { Injectable, signal } from '@angular/core';

export type Idioma = 'es' | 'eu';

@Injectable({ providedIn: 'root' })
export class IdiomaService {
  private readonly CLAVE = 'idioma-preferido';

  idioma = signal<Idioma>(this.cargarIdioma());

  private cargarIdioma(): Idioma {
    return (localStorage.getItem(this.CLAVE) as Idioma) ?? 'es';
  }

  cambiar(idioma: Idioma): void {
    this.idioma.set(idioma);
    localStorage.setItem(this.CLAVE, idioma);
  }

  toggle(): void {
    this.cambiar(this.idioma() === 'es' ? 'eu' : 'es');
  }
}