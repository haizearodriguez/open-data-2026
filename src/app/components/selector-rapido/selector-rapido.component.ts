import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoriaElemento, CATEGORIAS_ELEMENTOS } from 'src/app/core/models/mobiliario.model';

@Component({
  selector: 'app-selector-rapido',
  templateUrl: './selector-rapido.component.html',
  styleUrls: ['./selector-rapido.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class SelectorRapidoComponent {
  @Output() categoriaElegida = new EventEmitter<CategoriaElemento>();
  @Output() cerrar = new EventEmitter<void>();

  categoriasEspacioPublico = CATEGORIAS_ELEMENTOS.filter(c => c.grupo === 'espacio-publico');
  categoriasMedioambiente  = CATEGORIAS_ELEMENTOS.filter(c => c.grupo === 'medioambiente');

  seleccionar(cat: CategoriaElemento): void {
    this.categoriaElegida.emit(cat);
  }

  onCerrar(): void {
    this.cerrar.emit();
  }
}