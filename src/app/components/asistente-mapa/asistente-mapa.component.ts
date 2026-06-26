import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoriaElemento, CATEGORIAS_ELEMENTOS } from 'src/app/core/models/mobiliario.model';
import { AsistenteEvent } from 'src/app/core/interfaces/asistente';

export type AccionFinal = 'añadir-otro' | 'eliminar' | 'enviar';

type Paso = 'elegir-categoria' | 'esperando-clic' | 'que-mas';

@Component({
  selector: 'app-asistente-mapa',
  templateUrl: './asistente-mapa.component.html',
  styleUrls: ['./asistente-mapa.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class AsistenteMapaComponent {

  @Input() elementosColocados: number = 0;
  @Output() asistenteEvento = new EventEmitter<AsistenteEvent>();
  @Output() esperandoClic = new EventEmitter<void>();


  @Output() cerrar = new EventEmitter<void>();

  paso: Paso = 'elegir-categoria';
  categoriaElegida: CategoriaElemento | null = null;

  categoriasEspacioPublico = CATEGORIAS_ELEMENTOS.filter(c => c.grupo === 'espacio-publico');
  categoriasMedioambiente  = CATEGORIAS_ELEMENTOS.filter(c => c.grupo === 'medioambiente');

  elegirCategoria(cat: CategoriaElemento): void {
  this.categoriaElegida = cat;
  this.paso = 'esperando-clic';
  this.asistenteEvento.emit({ tipo: 'categoria-elegida', categoria: cat });
  this.esperandoClic.emit(); // avisa a la página para ocultar el panel
}

  /**
   * Llamado desde mapa.page cuando el usuario hace clic en el mapa y se coloca el marcador
   */
  confirmarColocacion(): void {
    this.paso = 'que-mas';
  }

  accionFinal(accion: AccionFinal): void {
    if (accion === 'añadir-otro') {
      this.paso = 'elegir-categoria';
      this.categoriaElegida = null;
    } else {
      this.asistenteEvento.emit({ tipo: 'accion-final', accion });

    }
  }

  onCerrar(): void {
    this.cerrar.emit();
  }
}