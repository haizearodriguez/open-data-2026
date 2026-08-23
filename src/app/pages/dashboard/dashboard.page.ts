import { Component, OnInit } from '@angular/core';
import { IdiomaSelectorComponent } from 'src/app/components/idioma-selector/idioma-selector.component';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent, IonSpinner, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton } from '@ionic/angular/standalone';
import { SupabaseService, DashboardData } from 'src/app/core/services/supabase.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IdiomaSelectorComponent, CommonModule, RouterLink, IonContent, IonSpinner, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton]
})
export class DashboardPage implements OnInit {
  datos: DashboardData | null = null;
  cargando = true;
  error = false;

  constructor(private supabaseService: SupabaseService) {}

  ngOnInit() { this.cargarDatos(); }

  async cargarDatos() {
    this.cargando = true;
    this.error = false;
    try {
      this.datos = await this.supabaseService.cargarDashboard();
    } catch (e: any) {
      console.error(
        'Error cargando dashboard:',
        e
      );

      this.error = true;
    } finally {
          this.cargando = false;
        }
  }

  porcentaje(count: number): number {
    if (!this.datos || this.datos.totalElementos === 0) return 0;
    return Math.round((count / this.datos.totalElementos) * 100);
  }

  maxBarrio(): number {
    if (!this.datos) return 1;
    return Math.max(...this.datos.porBarrio.map(b => b.count), 1);
  }

  maxSemana(): number {
    if (!this.datos) return 1;
    return Math.max(...this.datos.porSemana.map(s => s.count), 1);
  }
}