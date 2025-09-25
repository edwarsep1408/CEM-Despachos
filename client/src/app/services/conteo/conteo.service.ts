import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: 'root'
})
export class ConteoService {

  private url: string

  constructor(private http: HttpClient) {
    this.url = environment.apiUrl
  }

  Get(planilla_id: any, mesa: any): Observable<any> {
    return this.http.get<any>(`${this.url}/get-conteo/${planilla_id}/${mesa}`);

  }

  Post(data: any): Observable<any> {
    return this.http.post<any>(`${this.url}/post-conteo-inventario`, data);
  }

  GetConteoResumen(bodega: any, mesa: any, planilla: any): Observable<any> {
    return this.http.get<any>(`${this.url}/get-resumen-conteo/${bodega}/${mesa}/${planilla}`);

  }

  GetConteoResumenDashBoard(bodega: any, mesa: any): Observable<any> {
    return this.http.get<any>(`${this.url}/get-resumen-conteo-dashboard/${bodega}/${mesa}`);

  }

  GetConteoDetails (conteo: any){
    return this.http.get<any>(`${this.url}/get-resumen-conteo-details/${conteo}`);
  }

  GetLogs(planilla_id: any): Observable<any> {
    return this.http.get<any>(`${this.url}/get-log-conteo/${planilla_id}/`);

  }
  PostDiferencia(data: any): Observable<any> {
    return this.http.post<any>(`${this.url}/post-conteo-diferencia`, data);
  }

  PostCorreccion(data: any): Observable<any> {
    return this.http.post<any>(`${this.url}/post-conteo-correccion`, data);
  }
  PostCorreccionAdmin(data: any): Observable<any> {
    return this.http.post<any>(`${this.url}/post-conteo-correccion-admin`, data);
  }

}
