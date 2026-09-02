import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PedidosService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getPedidos(filtros?: { desde?: string; hasta?: string }): Observable<any> {
    let params = new HttpParams();
    if (filtros?.desde) params = params.set("desde", filtros.desde);
    if (filtros?.hasta) params = params.set("hasta", filtros.hasta);
    return this.http.get(`${this.url}/get-pedidos`, { params }).pipe(map((res: any) => res));
  }

  getPedido(idEnc: string): Observable<any> {
    return this.http
      .get(`${this.url}/get-pedido/${encodeURIComponent(idEnc)}`)
      .pipe(map((res: any) => res));
  }

  sincronizar(usuario: string, desde?: string, hasta?: string): Observable<any> {
    let params = new HttpParams().set('usuario', usuario);
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http
      .get(`${this.url}/sincronizar-pedidos-siesa`, { params })
      .pipe(map((res: any) => res));
  }

  cancelar(usuario: string): Observable<any> {
    return this.http
      .post(`${this.url}/cancelar-sincronizacion-pedidos`, { usuario })
      .pipe(map((res: any) => res));
  }

  ultimaSincronizacion(): Observable<any> {
    return this.http
      .get(`${this.url}/informacion-ultima-sincronizacion-pedidos`, {
        params: new HttpParams().set('_', String(Date.now())),
      })
      .pipe(map((res: any) => res));
  }

  getCompromisos(filtros?: { estado?: string; desde?: string; hasta?: string }): Observable<any> {
    let params = new HttpParams();
    if (filtros?.estado) params = params.set("estado", filtros.estado);
    if (filtros?.desde) params = params.set("desde", filtros.desde);
    if (filtros?.hasta) params = params.set("hasta", filtros.hasta);
    return this.http.get(`${this.url}/get-pedidos-compromiso`, { params });
  }

  comprometer(ids: string[]): Observable<any> {
    return this.http.put(`${this.url}/put-pedidos-comprometer`, { ids });
  }

  getCompromisosLog(filtros?: { idEnc?: string; desde?: string; hasta?: string }): Observable<any> {
    let params = new HttpParams();
    if (filtros?.idEnc) params = params.set("idEnc", filtros.idEnc);
    if (filtros?.desde) params = params.set("desde", filtros.desde);
    if (filtros?.hasta) params = params.set("hasta", filtros.hasta);
    return this.http.get(`${this.url}/get-compromisos-log`, { params });
  }
}
