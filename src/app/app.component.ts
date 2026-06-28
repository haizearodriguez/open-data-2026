import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  IonApp, IonRouterOutlet, IonMenu, IonHeader, IonToolbar,
  IonTitle, IonContent, IonList, IonItem, IonIcon, IonLabel,
  IonMenuToggle, MenuController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { mapOutline, gridOutline, chatbubbleOutline } from 'ionicons/icons';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [
    CommonModule,
    IonApp, IonRouterOutlet, IonMenu, IonHeader, IonToolbar,
    IonTitle, IonContent, IonList, IonItem, IonIcon, IonLabel,
    IonMenuToggle
  ],
})
export class AppComponent {
  constructor(private router: Router, private menuCtrl: MenuController) {
    addIcons({ mapOutline, gridOutline, chatbubbleOutline });
  }

  navegarA(ruta: string): void {
    this.menuCtrl.close();
    this.router.navigate([ruta]);
  }

  nuevaPropuesta(): void {
    this.menuCtrl.close();
    this.router.navigate(['/chat']); // página nueva, siempre se recrea
  }
}