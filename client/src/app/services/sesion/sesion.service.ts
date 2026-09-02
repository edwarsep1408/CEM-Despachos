import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from "../../../environments/environment";
import { PermisosSesion } from "../../core/permisos-sesion";
import { limpiarMuellePiso } from "../../components/portal-despachador/piso-ui";

@Injectable({
  providedIn: 'root'
})
export class SesionService {


  private url: string

  constructor(private http: HttpClient) {
    this.url = environment.apiUrl
  }

  Post(token: any): Observable<any> {
    return this.http.post<any>(`${this.url}/post-validar-sesion`, {token});
  }

  loginLocal(usuario: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.url}/post-login-local`, { usuario, password });
  }

  loginConductor(placa: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.url}/post-login-conductor`, { placa, password });
  }

  getToken(){
    return localStorage.getItem('token');
  }

  guardarSesion(token: string, identity: { nombre?: string; perfil?: string; permisos?: string[]; puedeFirmar?: boolean; origen?: string; placa?: string }) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', identity?.nombre || '');
    localStorage.setItem('correo', identity?.nombre || '');
    localStorage.setItem('message', '');
    if (identity?.origen) localStorage.setItem('origen', identity.origen);
    else localStorage.removeItem('origen');
    if (identity?.placa) localStorage.setItem('placa', identity.placa);
    else localStorage.removeItem('placa');
    PermisosSesion.guardar(identity || {});
  }

  cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('correo');
    localStorage.removeItem('message');
    localStorage.removeItem('origen');
    localStorage.removeItem('placa');
    PermisosSesion.limpiar();
    limpiarMuellePiso();
  }


}
