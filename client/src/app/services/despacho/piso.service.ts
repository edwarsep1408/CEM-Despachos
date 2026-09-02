import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class PisoService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getCargues(): Observable<any> {
    return this.http.get(`${this.url}/get-piso-cargues`);
  }

  getCargue(id: string): Observable<any> {
    return this.http.get(`${this.url}/get-piso-cargue/${id}`);
  }

  omitirDocumento(payload: { cargueId: string; docId: string; motivo: string }): Observable<any> {
    return this.http.put(`${this.url}/put-piso-omitir-documento`, payload);
  }

  omitirLinea(payload: {
    cargueId: string;
    docId: string;
    lineaId: string;
    motivo: string;
  }): Observable<any> {
    return this.http.put(`${this.url}/put-piso-omitir-linea`, payload);
  }

  registrarPesaje(payload: {
    cargueId: string;
    docId: string;
    lineaId: string;
    unidades: number;
    peso: number;
    tara: number;
    taraDetalle?: Record<string, number>;
    lote?: string;
    temperatura?: string;
    fechaVencimiento?: string;
  }): Observable<any> {
    return this.http.post(`${this.url}/post-piso-pesaje`, payload);
  }

  quitarPesaje(payload: {
    cargueId: string;
    docId: string;
    lineaId: string;
    idPesaje: string;
  }): Observable<any> {
    return this.http.put(`${this.url}/put-piso-quitar-pesaje`, payload);
  }

  finalizarDocumento(payload: { cargueId: string; docId: string; forzar?: boolean }): Observable<any> {
    return this.http.put(`${this.url}/put-piso-finalizar-documento`, payload);
  }

  repesar(payload: { cargueId: string; docId: string; lineaId?: string }): Observable<any> {
    return this.http.put(`${this.url}/put-piso-repesar`, payload);
  }

  registrarEtiquetas(payload: {
    cargueId: string;
    docId: string;
    totalCanastas: number;
  }): Observable<any> {
    return this.http.put(`${this.url}/put-piso-etiquetas`, payload);
  }
}
