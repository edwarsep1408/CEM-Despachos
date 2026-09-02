import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class CarguesService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getPendientes(): Observable<any> {
    return this.http.get(`${this.url}/get-cargues-pendientes`);
  }

  getBodegasPedidos(): Observable<any> {
    return this.http.get(`${this.url}/get-bodegas-pedidos`);
  }

  getCargue(id: string): Observable<any> {
    return this.http.get(`${this.url}/get-cargue/${id}`);
  }

  postCargue(despachadorId: string): Observable<any> {
    return this.http.post(`${this.url}/post-cargue`, { despachadorId });
  }

  getDocumentos(cargueId: string, tipo: string): Observable<any> {
    return this.http.get(`${this.url}/get-documentos-cargue`, {
      params: { cargueId, tipo },
    });
  }

  agregarDocumentos(payload: { _id: string; tipo: string; ids: string[] }): Observable<any> {
    return this.http.put(`${this.url}/put-cargue-documentos`, payload);
  }

  eliminarDocumentos(payload: { _id: string; ids: string[] }): Observable<any> {
    return this.http.put(`${this.url}/put-cargue-eliminar-documentos`, payload);
  }

  getEstadoCargues(): Observable<any> {
    return this.http.get(`${this.url}/get-estado-cargues`);
  }

  getEstadoCargue(id: string): Observable<any> {
    return this.http.get(`${this.url}/get-estado-cargue/${id}`);
  }

  enviar(id: string): Observable<any> {
    return this.http.put(`${this.url}/put-cargue-enviar/${id}`, {});
  }

  devolverADespachos(id: string): Observable<any> {
    return this.http.put(`${this.url}/put-cargue-devolver-despachos/${id}`, {});
  }
}
