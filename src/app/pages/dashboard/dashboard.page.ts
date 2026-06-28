import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonSpinner, IonHeader, IonToolbar, IonTitle, IonButtons, IonMenuButton } from '@ionic/angular/standalone';
import { SupabaseService, DashboardData } from 'src/app/core/services/supabase.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonButtons, IonToolbar, IonTitle, CommonModule, IonContent, IonSpinner, IonHeader, IonMenuButton]
})
export class DashboardPage implements OnInit {
  datos: DashboardData | null = null;
  cargando = true;
  error = false;

  constructor(private supabaseService: SupabaseService) {}

  ngOnInit() {
    this.cargarDatos();
  }

  async cargarDatos() {
    this.cargando = true;
    this.error = false;
    try {
      this.datos = await this.supabaseService.cargarDashboard();
    } catch (e) {
      console.error('Error cargando dashboard:', e);
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