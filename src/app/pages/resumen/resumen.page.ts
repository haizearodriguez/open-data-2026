import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { MobiliarioService } from 'src/app/core/services/mobiliario.service';
import { SupabaseService } from 'src/app/core/services/supabase.service';
import { ElementoMobiliario, CATEGORIAS_ELEMENTOS } from 'src/app/core/models/mobiliario.model';

@Component({
  selector: 'app-resumen',
  templateUrl: './resumen.page.html',
  styleUrls: ['./resumen.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSpinner]
})
export class ResumenPage implements OnInit {

  elementos: ElementoMobiliario[] = [];
  barrio = '';

  nombre = '';
  primerApellido = '';
  segundoApellido = '';
  dni = '';
  emailCiudadano = '';
  titulo = '';
  descripcion = '';

  enviando = false;
  generando = false;
  error = '';
  errorIa = '';
  referencia: string | null = null;

  constructor(
    private mobiliarioService: MobiliarioService,
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  ngOnInit() {
    this.elementos = this.mobiliarioService.obtenerPropuestaActual();
    this.barrio = this.elementos[0]?.barrio ?? '';

    const tipos = [...new Set(this.elementos.map(e => this.getEtiqueta(e.tipo)))];
    this.titulo = `Solicitud de mejora en ${this.barrio}: ${tipos.join(', ')}`;
    this.descripcion = '';
  }

  getEmoji(tipo: string): string {
    return CATEGORIAS_ELEMENTOS.find(c => c.tipo === tipo)?.emoji ?? '📍';
  }

  getEtiqueta(tipo: string): string {
    return CATEGORIAS_ELEMENTOS.find(c => c.tipo === tipo)?.etiqueta ?? tipo;
  }

  formularioValido(): boolean {
    return !!(
      this.nombre.trim() &&
      this.primerApellido.trim() &&
      this.dni.trim() &&
      this.emailCiudadano.trim() &&
      this.titulo.trim() &&
      this.descripcion.trim()
    );
  }

  generarReferencia(): string {
    const fecha = new Date();
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    const aleatorio = Math.floor(Math.random() * 9000 + 1000);
    return `VGZ-${año}${mes}${dia}-${aleatorio}`;
  }

  async generarConIa() {
    this.generando = true;
    this.errorIa = '';

    try {
      const url = `${this.supabaseService.getFunctionUrl()}/generar-texto`;
      const elementosPayload = this.elementos.map(e => ({
        etiqueta: this.getEtiqueta(e.tipo),
        emoji: this.getEmoji(e.tipo),
        coordenadas: e.coordenadas,
      }));

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseService.getAnonKey(),
        },
        body: JSON.stringify({ barrio: this.barrio, elementos: elementosPayload }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      this.titulo = json.titulo;
      this.descripcion = json.descripcion;

    } catch (e: any) {
      this.errorIa = 'No se pudo generar el texto. Inténtalo de nuevo.';
      console.error(e);
    } finally {
      this.generando = false;
    }
  }

  async enviar() {
    if (!this.formularioValido()) return;

    this.enviando = true;
    this.error = '';

    const referencia = this.generarReferencia();
    const elementosConEmoji = this.elementos.map(e => ({
      tipo: e.tipo,
      etiqueta: this.getEtiqueta(e.tipo),
      emoji: this.getEmoji(e.tipo),
      barrio: e.barrio,
      coordenadas: e.coordenadas,
    }));

    try {
      const url = `${this.supabaseService.getFunctionUrl()}/enviar-propuesta`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.supabaseService.getAnonKey(),
        },
        body: JSON.stringify({
          nombre: this.nombre.trim(),
          primerApellido: this.primerApellido.trim(),
          segundoApellido: this.segundoApellido.trim() || undefined,
          dni: this.dni.trim().toUpperCase(),
          emailCiudadano: this.emailCiudadano.trim(),
          barrio: this.barrio,
          elementos: elementosConEmoji,
          titulo: this.titulo.trim(),
          detalle: this.descripcion.trim(),
          referencia,
        }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      this.referencia = referencia;
      this.mobiliarioService.limpiarPropuesta();

    } catch (e: any) {
      this.error = 'No se pudo enviar la propuesta. Inténtalo de nuevo.';
      console.error(e);
    } finally {
      this.enviando = false;
    }
  }

  volver() {
    // Usa history.back() para volver con el state correcto
    history.back();
  }
}