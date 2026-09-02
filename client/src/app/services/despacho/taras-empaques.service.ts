import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class TarasEmpaquesService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  Get(): Observable<any> {
    return this.http.get(`${this.url}/get-taras`);
  }

  Post(data: any): Observable<any> {
    return this.http.post(`${this.url}/post-tara`, data);
  }

  Put(data: any): Observable<any> {
    return this.http.put(`${this.url}/put-tara`, data);
  }

  Delete(_id: string) {
    return this.http.delete(`${this.url}/delete-tara/${_id}`);
  }
}
