import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class LocalizacionesService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listar(filtros: { q?: string; cadena?: string; zona?: string } = {}): Observable<any> {
    let params = new HttpParams();
    Object.entries(filtros || {}).forEach(([k, v]) => {
      if (v) params = params.set(k, String(v));
    });
    return this.http.get(`${this.url}/get-localizaciones`, { params });
  }

  crear(payload: any): Observable<any> {
    return this.http.post(`${this.url}/post-localizacion`, payload);
  }

  actualizar(payload: any): Observable<any> {
    return this.http.put(`${this.url}/put-localizacion`, payload);
  }

  eliminar(_id: string): Observable<any> {
    return this.http.delete(`${this.url}/delete-localizacion/${_id}`);
  }

  importarArchivo(archivo: File): Observable<any> {
    const data = new FormData();
    data.append("archivo", archivo, archivo.name);
    return this.http.post(`${this.url}/post-localizaciones-archivo`, data);
  }

  importarPlantilla(): Observable<any> {
    return this.http.post(`${this.url}/post-localizaciones-plantilla`, {});
  }
}
