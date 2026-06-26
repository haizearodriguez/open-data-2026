import { AccionFinal } from "src/app/components/asistente-mapa/asistente-mapa.component";
import { CategoriaElemento } from "../models/mobiliario.model";

export interface AsistenteEvent {
  tipo: 'categoria-elegida' | 'accion-final';
  categoria?: CategoriaElemento;
  accion?: AccionFinal;
}