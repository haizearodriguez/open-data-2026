import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { IonButton, IonList } from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { MapaService } from 'src/app/core/services/mapa.service';
import { Message } from 'src/app/core/interfaces/message';

@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss'],
  imports: [IonButton, IonList, CommonModule]
})
export class ChatbotComponent implements OnInit {
  @Output() chatFinished = new EventEmitter<{ barrio: string, opcion: string}>();

  messages: Message[] = [];
  step: 'barrio' | 'fin' = 'barrio';

  selectedBarrio: string = '';
  selectedNecesidad: string = '';

  barrios: string[] = [];

  constructor(private mapaService: MapaService) {}

  ngOnInit(): void {
    this.cargarBarriosDesdeJson();
  }

  private cargarBarriosDesdeJson(): void {
    // Reutilizamos getBarrios() — si ya fue llamado antes, devuelve el caché sin nueva petición HTTP
    this.mapaService.getBarrios().subscribe({
      next: (data) => {
        if (data && data.features) {
          this.barrios = data.features
            .map(f => f.attributes?.TEXTO)
            .filter((name): name is string => !!name)
            .sort((a, b) => a.localeCompare(b));

          this.iniciarChat();
        }
      },
      error: (err) => {
        console.error('Error cargando el listado de barrios en el chatbot:', err);
        this.barrios = ['Casco Viejo', 'Zabalgana', 'Salburua'];
        this.iniciarChat();
      }
    });
  }

  private iniciarChat(): void {
    this.messages.push({
      text: '¡Hola! Soy el asistente urbano de Vitoria-Gasteiz. ¿De qué barrio eres?',
      sender: 'bot'
    });
  }

  seleccionarBarrio(barrio: string): void {
    this.selectedBarrio = barrio;
    this.messages.push({ text: barrio, sender: 'user' });

    this.step = 'fin';
    this.messages.push({
      text: 'Procesando datos espaciales... Hecho. ¡Actualizando el mapa interactivo!',
      sender: 'bot'
    });

    this.chatFinished.emit({
      barrio: this.selectedBarrio,
      opcion: '',
    });

  }
}