import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoriaElemento } from 'src/app/core/models/mobiliario.model';

@Component({
  selector: 'app-asistente-mapa',
  templateUrl: './asistente-mapa.component.html',
  styleUrls: ['./asistente-mapa.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class AsistenteMapaComponent {
  @Input() elementosColocados: number = 0;
  @Input() categoriaActiva: CategoriaElemento | null = null;
  @Output() cerrar = new EventEmitter<void>();

  reiniciarParaNuevo(): void {}

  onCerrar(): void {
    this.cerrar.emit();
  }
}