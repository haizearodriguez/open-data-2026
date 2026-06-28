import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton } from '@ionic/angular/standalone';
import { ChatbotComponent, ChatFinishedEvent } from 'src/app/components/chatbot/chatbot.component';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton,
    ChatbotComponent
  ]
})
export class ChatPage {
  chatKey = Date.now(); // cambia cada vez → fuerza recreación del chatbot

  constructor(private router: Router) {}

 ionViewWillEnter(): void {
  this.chatKey = 0;
  setTimeout(() => { this.chatKey = Date.now(); }, 50);
}

  onChatFinished(event: ChatFinishedEvent): void {
    if (event.modo === 'foto') {
      this.router.navigate(['/foto']);
    } else {
      this.router.navigate(['/mapa'], {
        state: {
          barrio: event.barrio,
          modo: event.modo,
          categoria: event.categoria
        }
      });
    }
  }
}