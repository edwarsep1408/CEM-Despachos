import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class LiquidacionService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  avance(fecha: string): Observable<any> {
    return this.http.get(`${this.url}/get-liquidacion-avance`, { params: new HttpParams().set("fecha", fecha) });
  }

  hojas(fecha: string, bodega = ""): Observable<any> {
    let params = new HttpParams().set("fecha", fecha);
    if (bodega) params = params.set("bodega", bodega);
    return this.http.get(`${this.url}/get-liquidacion-hojas`, { params });
  }

  hoja(hojaId: string): Observable<any> {
    return this.http.get(`${this.url}/get-liquidacion-hoja/${encodeURIComponent(hojaId)}`);
  }

  historico(fecha: string, placa = ""): Observable<any> {
    let params = new HttpParams().set("fecha", fecha);
    if (placa) params = params.set("placa", placa);
    return this.http.get(`${this.url}/get-liquidacion-historico`, { params });
  }

  guardarCierre(hojaId: string, body: any): Observable<any> {
    return this.http.put(`${this.url}/put-liquidacion-cierre/${encodeURIComponent(hojaId)}`, body);
  }

  agregarConsignacion(hojaId: string, body: any): Observable<any> {
    return this.http.post(`${this.url}/post-liquidacion-consignacion/${encodeURIComponent(hojaId)}`, body);
  }

  eliminarConsignacion(hojaId: string, consignacionId: string): Observable<any> {
    return this.http.delete(
      `${this.url}/delete-liquidacion-consignacion/${encodeURIComponent(hojaId)}/${encodeURIComponent(consignacionId)}`
    );
  }

  guardarGastos(hojaId: string, body: any): Observable<any> {
    return this.http.put(`${this.url}/put-liquidacion-gastos/${encodeURIComponent(hojaId)}`, body);
  }

  aprobar(hojaId: string, body: any = {}): Observable<any> {
    return this.http.post(`${this.url}/post-liquidacion-aprobar/${encodeURIComponent(hojaId)}`, body);
  }

  rechazar(hojaId: string, body: any = {}): Observable<any> {
    return this.http.post(`${this.url}/post-liquidacion-rechazar/${encodeURIComponent(hojaId)}`, body);
  }
}
