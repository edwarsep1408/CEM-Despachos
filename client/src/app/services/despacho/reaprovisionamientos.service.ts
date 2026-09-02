import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class ReaprovisionamientosService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listar(filtros: {
    estado?: string;
    desde?: string;
    hasta?: string;
    origen?: string;
    destino?: string;
  }): Observable<any> {
    let params = new HttpParams();
    Object.entries(filtros || {}).forEach(([key, value]) => {
      if (value) params = params.set(key, String(value));
    });
    return this.http.get(`${this.url}/get-reaprovisionamientos`, { params });
  }

  get(_id: string): Observable<any> {
    return this.http.get(`${this.url}/get-reaprovisionamiento/${_id}`);
  }

  crear(data: {
    fecha?: string;
    bodegaOrigen: string;
    bodegaDestino: string;
    bodegaOrigenNombre?: string;
    bodegaDestinoNombre?: string;
    observacion?: string;
  }): Observable<any> {
    return this.http.post(`${this.url}/post-reaprovisionamiento`, data);
  }

  actualizar(payload: any): Observable<any> {
    return this.http.put(`${this.url}/put-reaprovisionamiento`, payload);
  }

  aprobar(_id: string): Observable<any> {
    return this.http.put(`${this.url}/put-reaprovisionamiento-aprobar/${_id}`, {});
  }

  anular(_id: string): Observable<any> {
    return this.http.put(`${this.url}/put-reaprovisionamiento-anular/${_id}`, {});
  }

  enviarSiesa(_id: string): Observable<any> {
    return this.http.put(`${this.url}/put-reaprovisionamiento-siesa/${_id}`, {});
  }

  buscarItems(q: string): Observable<any> {
    return this.http.get(`${this.url}/get-reaprovisionamiento-items`, {
      params: { q },
    });
  }

  importarExcel(payload: {
    archivo: File;
    fecha?: string;
    bodegaOrigen: string;
    bodegaOrigenNombre?: string;
    observacion?: string;
  }): Observable<any> {
    const data = new FormData();
    data.append("archivo", payload.archivo, payload.archivo.name);
    if (payload.fecha) data.append("fecha", payload.fecha);
    data.append("bodegaOrigen", payload.bodegaOrigen);
    if (payload.bodegaOrigenNombre) data.append("bodegaOrigenNombre", payload.bodegaOrigenNombre);
    if (payload.observacion) data.append("observacion", payload.observacion);
    return this.http.post(`${this.url}/post-reaprovisionamiento-excel`, data);
  }
}
