import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton
} from '@ionic/angular/standalone';
import { ChatbotComponent, ChatFinishedEvent } from 'src/app/components/chatbot/chatbot.component';
import { IdiomaSelectorComponent } from 'src/app/components/idioma-selector/idioma-selector.component';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IdiomaSelectorComponent, ChatbotComponent
  ]
})
export class ChatPage {
  chatKey = Date.now();
  mostrarBannerInstall = false;
  private installPrompt: any = null;
  private static listenersRegistrados = false;

  constructor(private router: Router) {
    if (!ChatPage.listenersRegistrados) {
      ChatPage.listenersRegistrados = true;
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.installPrompt = e;
        this.mostrarBannerInstall = true;
      });
      window.addEventListener('appinstalled', () => {
        this.mostrarBannerInstall = false;
        this.installPrompt = null;
      });
    }
  }

  ionViewWillEnter(): void {
    this.chatKey = 0;
    setTimeout(() => { this.chatKey = Date.now(); }, 50);
  }

  async instalarPwa(): Promise<void> {
    if (!this.installPrompt) return;
    this.installPrompt.prompt();
    const { outcome } = await this.installPrompt.userChoice;
    if (outcome === 'accepted') {
      this.mostrarBannerInstall = false;
      this.installPrompt = null;
    }
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

  irDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}