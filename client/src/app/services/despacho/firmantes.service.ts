import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class FirmantesService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listar(cargo?: string): Observable<any> {
    let params = new HttpParams();
    if (cargo) params = params.set("cargo", cargo);
    return this.http.get(`${this.url}/get-firmantes`, { params });
  }

  miFirma(): Observable<any> {
    return this.http.get(`${this.url}/get-mi-firma`);
  }

  guardarMiFirma(firma: string): Observable<any> {
    return this.http.put(`${this.url}/put-mi-firma`, { firma });
  }

  crear(data: { nombre: string; cargo: string; firma: string }): Observable<any> {
    return this.http.post(`${this.url}/post-firmante`, data);
  }

  actualizar(data: { _id: string; nombre: string; cargo: string; firma?: string }): Observable<any> {
    return this.http.put(`${this.url}/put-firmante`, data);
  }

  eliminar(_id: string) {
    return this.http.delete(`${this.url}/delete-firmante/${_id}`);
  }
}
