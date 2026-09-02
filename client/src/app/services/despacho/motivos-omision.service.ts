import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class MotivosOmisionService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  Get(): Observable<any> {
    return this.http.get(`${this.url}/get-motivos-omision`);
  }

  Post(data: any): Observable<any> {
    return this.http.post(`${this.url}/post-motivo-omision`, data);
  }

  Put(data: any): Observable<any> {
    return this.http.put(`${this.url}/put-motivo-omision`, data);
  }

  Delete(_id: string) {
    return this.http.delete(`${this.url}/delete-motivo-omision/${_id}`);
  }
}
