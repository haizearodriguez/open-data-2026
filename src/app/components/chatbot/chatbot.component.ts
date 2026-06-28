import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { IonButton, IonList } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { MapaService } from 'src/app/core/services/mapa.service';
import { Message } from 'src/app/core/interfaces/message';
import { CategoriaElemento, CATEGORIAS_ELEMENTOS } from 'src/app/core/models/mobiliario.model';

export type ModoReporte = 'manual' | 'foto';

export interface ChatFinishedEvent {
  barrio: string;
  modo: ModoReporte;
  categoria?: CategoriaElemento;
}

@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss'],
  standalone: true,
  imports: [IonList, IonButton, CommonModule]
})
export class ChatbotComponent implements OnInit {
  @Output() chatFinished = new EventEmitter<ChatFinishedEvent>();

  messages: Message[] = [];
  step: 'modo' | 'barrio' | 'categoria' | 'fin' = 'modo';

  selectedModo: ModoReporte | null = null;
  selectedBarrio = '';
  selectedCategoria: CategoriaElemento | null = null;

  barrios: string[] = [];
  categoriasEspacioPublico = CATEGORIAS_ELEMENTOS.filter(c => c.grupo === 'espacio-publico');
  categoriasMedioambiente  = CATEGORIAS_ELEMENTOS.filter(c => c.grupo === 'medioambiente');

  constructor(private mapaService: MapaService) {}

  ngOnInit(): void {
    this.mapaService.getBarrios().subscribe({
      next: (data) => {
        if (data?.features) {
          this.barrios = data.features
            .map(f => f.attributes?.TEXTO)
            .filter((name): name is string => !!name)
            .sort((a, b) => a.localeCompare(b));
        }
        this.messages.push({
          text: '¡Hola! Soy el asistente urbano de Vitoria-Gasteiz. ¿Cómo quieres reportar una incidencia?',
          sender: 'bot'
        });
      },
      error: () => {
        this.barrios = ['Casco Viejo', 'Zabalgana', 'Salburua'];
        this.messages.push({
          text: '¡Hola! Soy el asistente urbano de Vitoria-Gasteiz. ¿Cómo quieres reportar una incidencia?',
          sender: 'bot'
        });
      }
    });
  }

  seleccionarModo(modo: ModoReporte): void {
    this.selectedModo = modo;
    this.messages.push({ text: modo === 'manual' ? 'Manualmente' : 'Con una foto', sender: 'user' });

    if (modo === 'foto') {
      this.step = 'fin';
      this.messages.push({
        text: 'Perfecto, vamos a usar la cámara para identificar el problema automáticamente.',
        sender: 'bot'
      });
      this.chatFinished.emit({ barrio: '', modo: 'foto' });
    } else {
      this.step = 'barrio';
      this.messages.push({ text: '¿De qué barrio eres?', sender: 'bot' });
    }
  }

  seleccionarBarrio(barrio: string): void {
    this.selectedBarrio = barrio;
    this.messages.push({ text: barrio, sender: 'user' });
    this.step = 'categoria';
    this.messages.push({ text: '¿Qué quieres añadir o reportar?', sender: 'bot' });
  }

  seleccionarCategoria(cat: CategoriaElemento): void {
    this.selectedCategoria = cat;
    this.messages.push({ text: `${cat.emoji} ${cat.etiqueta}`, sender: 'user' });
    this.step = 'fin';
    this.messages.push({
      text: `Perfecto. Cargando el mapa de ${this.selectedBarrio}... Toca el lugar exacto donde quieres añadir la incidencia.`,
      sender: 'bot'
    });
    this.chatFinished.emit({
      barrio: this.selectedBarrio,
      modo: 'manual',
      categoria: cat
    });
  }

  volver(): void {
    if (this.step === 'barrio') {
      this.step = 'modo';
      this.messages.push({ text: '← Volver', sender: 'user' });
      this.messages.push({ text: '¿Cómo quieres reportar una incidencia?', sender: 'bot' });
    } else if (this.step === 'categoria') {
      this.step = 'barrio';
      this.messages.push({ text: '← Volver', sender: 'user' });
      this.messages.push({ text: '¿De qué barrio eres?', sender: 'bot' });
    }
  }
}