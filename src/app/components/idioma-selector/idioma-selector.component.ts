import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IdiomaService } from 'src/app/core/services/idioma.service';

@Component({
  selector: 'app-idioma-selector',
  templateUrl: './idioma-selector.component.html',
  styleUrls: ['./idioma-selector.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class IdiomaSelectorComponent {
  constructor(public idiomaService: IdiomaService) {}
}