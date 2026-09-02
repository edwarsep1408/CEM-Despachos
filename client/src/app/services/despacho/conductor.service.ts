import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class ConductorService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getHojas(): Observable<any> {
    return this.http.get(`${this.url}/get-conductor-hojas`);
  }

  getHoja(hojaId: string): Observable<any> {
    return this.http.get(`${this.url}/get-conductor-hoja/${encodeURIComponent(hojaId)}`);
  }

  getFactura(hojaId: string, docId: string): Observable<any> {
    return this.http.get(
      `${this.url}/get-conductor-factura/${encodeURIComponent(hojaId)}/${encodeURIComponent(docId)}`
    );
  }

  guardarEntrega(hojaId: string, docId: string, body: any): Observable<any> {
    return this.http.put(
      `${this.url}/put-conductor-entrega/${encodeURIComponent(hojaId)}/${encodeURIComponent(docId)}`,
      body
    );
  }

  leerComprobante(foto: string): Observable<any> {
    return this.http.post(`${this.url}/post-conductor-leer-comprobante`, { foto });
  }
}
