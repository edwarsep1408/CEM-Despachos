import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class OrdenesCompraService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listar(filtros: {
    estado?: string;
    desde?: string;
    hasta?: string;
    id?: string;
    numOrden?: string;
    bodega?: string;
    cliente?: string;
    localizacion?: string;
    q?: string;
  }): Observable<any> {
    let params = new HttpParams();
    Object.entries(filtros || {}).forEach(([key, value]) => {
      if (value) params = params.set(key, String(value));
    });
    return this.http.get(`${this.url}/get-ordenes-compra`, { params });
  }

  get(_id: string): Observable<any> {
    return this.http.get(`${this.url}/get-orden-compra/${_id}`);
  }

  importarHse(payload: {
    archivo: File;
    bodegaOrigen: string;
    bodegaOrigenNombre?: string;
  }): Observable<any> {
    const data = new FormData();
    data.append("archivo", payload.archivo, payload.archivo.name);
    data.append("bodegaOrigen", payload.bodegaOrigen);
    if (payload.bodegaOrigenNombre) data.append("bodegaOrigenNombre", payload.bodegaOrigenNombre);
    return this.http.post(`${this.url}/post-orden-compra-hse`, data);
  }

  anular(_id: string): Observable<any> {
    return this.http.put(`${this.url}/put-orden-compra-anular/${_id}`, {});
  }
}
