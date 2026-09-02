import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class SeguridadService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getPermisos(): Observable<any> {
    return this.http.get(`${this.url}/get-permisos`);
  }
  postPermiso(data: any): Observable<any> {
    return this.http.post(`${this.url}/post-permiso`, data);
  }
  putPermiso(data: any): Observable<any> {
    return this.http.put(`${this.url}/put-permiso`, data);
  }
  deletePermiso(_id: string): Observable<any> {
    return this.http.delete(`${this.url}/delete-permiso/${_id}`);
  }

  getPerfiles(): Observable<any> {
    return this.http.get(`${this.url}/get-perfiles`);
  }
  postPerfil(data: any): Observable<any> {
    return this.http.post(`${this.url}/post-perfil`, data);
  }
  putPerfil(data: any): Observable<any> {
    return this.http.put(`${this.url}/put-perfil`, data);
  }
  deletePerfil(_id: string): Observable<any> {
    return this.http.delete(`${this.url}/delete-perfil/${_id}`);
  }

  getUsuarios(): Observable<any> {
    return this.http.get(`${this.url}/get-usuarios`);
  }
  postUsuario(data: any): Observable<any> {
    return this.http.post(`${this.url}/post-usuario`, data);
  }
  putUsuario(data: any): Observable<any> {
    return this.http.put(`${this.url}/put-usuario`, data);
  }
  putUsuarioEstado(_id: string, activo: boolean): Observable<any> {
    return this.http.put(`${this.url}/put-usuario-estado`, { _id, activo });
  }

  getDespachadores(): Observable<any> {
    return this.http.get(`${this.url}/get-despachadores`);
  }

  putAsignacionBodega(data: { _id: string; bodega: string; bodegaNombre: string }): Observable<any> {
    return this.http.put(`${this.url}/put-asignacion-bodega`, data);
  }
}
