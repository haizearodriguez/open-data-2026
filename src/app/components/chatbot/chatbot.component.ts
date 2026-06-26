import { BarrioData } from './../../core/models/barrio.model';
import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IonButton, IonList } from "@ionic/angular/standalone";
import { CommonModule } from '@angular/common';

interface Message {
  text: string;
  sender: 'bot' | 'user';
}

@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss'],
  imports : [IonButton, IonList, CommonModule]
})
export class ChatbotComponent implements OnInit {
  @Output() chatFinished = new EventEmitter<{ barrio: string; necesidad: string }>();

  messages: Message[] = [];
  step: 'barrio' | 'necesidad' | 'fin' = 'barrio';
  
  selectedBarrio: string = '';
  selectedNecesidad: string = '';

  // Inicialmente vacío, se llenará con el JSON oficial
  barrios: string[] = [];
  necesidades: string[] = ['Árboles', 'Mobiliario', 'Iluminación']; // Tus opciones de ejemplo

  // Inyectamos el HttpClient en el constructor
  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarBarriosDesdeJson();
  }

  private cargarBarriosDesdeJson(): void {
    this.http.get<BarrioData>('assets/data/barrios-vitoria.json').subscribe({
      next: (data) => {
        if (data && data.features) {
          // Mapeamos los nombres de los barrios (TEXTO) y eliminamos duplicados o vacíos si los hubiera
          this.barrios = data.features
            .map(f => f.attributes?.TEXTO)
            .filter((name): name is string => !!name)
            .sort((a, b) => a.localeCompare(b)); // Los ordenamos alfabéticamente de la A a la Z
          
          // Una vez cargados los barrios, iniciamos el saludo del bot
          this.iniciarChat();
        }
      },
      error: (err) => {
        console.error('Error cargando el listado de barrios en el chatbot:', err);
        // Fallback por si el JSON falla en desarrollo
        this.barrios = ['Casco Viejo', 'Zabalgana', 'Salburua'];
        this.iniciarChat();
      }
    });
  }

  private iniciarChat(): void {
    this.messages.push({
      text: '¡Hola! Soy el asistente urbano de Vitoria-Gasteiz. ¿De qué barrio quieres consultar la información?',
      sender: 'bot'
    });
  }

  seleccionarBarrio(barrio: string): void {
    this.selectedBarrio = barrio;
    this.messages.push({ text: barrio, sender: 'user' });
    
    this.step = 'necesidad';
    this.messages.push({
      text: `Perfecto. ¿Qué necesidad o elemento te interesa revisar en ${barrio}?`,
      sender: 'bot'
    });
  }

  seleccionarNecesidad(necesidad: string): void {
    this.selectedNecesidad = necesidad;
    this.messages.push({ text: necesidad, sender: 'user' });
    
    this.step = 'fin';
    this.messages.push({
      text: 'Procesando datos espaciales... Hecho. ¡Actualizando el mapa interactivo!',
      sender: 'bot'
    });

    // Emitimos los datos limpios al mapa de la página principal
    this.chatFinished.emit({
      barrio: this.selectedBarrio,
      necesidad: this.selectedNecesidad
    });
  }
}