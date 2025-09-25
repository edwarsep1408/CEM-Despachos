import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: 'root'
})
export class SesionService {


  private url: string

  constructor(private http: HttpClient) {
    this.url = environment.apiUrl
  }

  Post(token: any): Observable<any> {
    return this.http.post<any>(`${this.url}/post-validar-sesion`, {token});
  }

  getToken(){
    return localStorage.getItem('token');
  }


}
