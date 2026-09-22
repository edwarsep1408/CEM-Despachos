import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class CodigosEanService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  Get(q = ""): Observable<any> {
    let params = new HttpParams();
    if (q) params = params.set("q", q);
    return this.http.get(`${this.url}/get-codigos-ean`, { params });
  }

  Post(body: {
    ean: string;
    cliente?: string;
    localizacion?: string;
    referencia: string;
    descripcion?: string;
  }): Observable<any> {
    return this.http.post(`${this.url}/post-codigo-ean`, body);
  }

  Put(body: any): Observable<any> {
    return this.http.put(`${this.url}/put-codigo-ean`, body);
  }

  Delete(_id: string): Observable<any> {
    return this.http.delete(`${this.url}/delete-codigo-ean/${_id}`);
  }

  importarCsv(archivo?: File): Observable<any> {
    const data = new FormData();
    if (archivo) data.append("archivo", archivo, archivo.name);
    return this.http.post(`${this.url}/post-codigos-ean-csv`, data);
  }
}
