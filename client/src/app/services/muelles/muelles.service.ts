import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class MuellesService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  Get(): Observable<any> {
    return this.http.get(`${this.url}/get-muelles`);
  }

  GetPiso(): Observable<any> {
    return this.http.get(`${this.url}/get-muelles-piso`);
  }

  GetPorBodega(bodega: string): Observable<any> {
    return this.http.get(`${this.url}/get-muelles-bodega/${bodega}`);
  }

  Post(data: any): Observable<any> {
    return this.http.post(`${this.url}/post-muelle`, data);
  }

  Put(data: any): Observable<any> {
    return this.http.put(`${this.url}/put-muelle`, data);
  }

  Delete(_id: string) {
    return this.http.delete(`${this.url}/delete-muelle/${_id}`);
  }
}
