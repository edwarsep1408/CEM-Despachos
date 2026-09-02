import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class BasculasService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  Get(): Observable<any> {
    return this.http.get(`${this.url}/get-basculas`);
  }

  GetPiso(muelleId?: string): Observable<any> {
    const q = muelleId ? `?muelle=${encodeURIComponent(muelleId)}` : "";
    return this.http.get(`${this.url}/get-bascula-piso${q}`);
  }

  GetPorBodega(bodega: string): Observable<any> {
    return this.http.get(`${this.url}/get-basculas-bodega/${bodega}`);
  }

  Post(data: any): Observable<any> {
    return this.http.post(`${this.url}/post-bascula`, data);
  }

  Put(data: any): Observable<any> {
    return this.http.put(`${this.url}/put-bascula`, data);
  }

  Delete(_id: string) {
    return this.http.delete(`${this.url}/delete-bascula/${_id}`);
  }

  Escuchar(_id: string) {
    return this.http.post(`${this.url}/escuchar-bascula/${_id}`, {});
  }

  Detener(_id: string) {
    return this.http.post(`${this.url}/detener-bascula/${_id}`, {});
  }

  Enviar(_id: string, data: { texto: string; crlf: string }) {
    return this.http.post(`${this.url}/enviar-bascula/${_id}`, data);
  }
}
