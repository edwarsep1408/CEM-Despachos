import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: 'root'
})
export class PersonalService {


  private url: string

  constructor(private http: HttpClient) {
    this.url = environment.apiUrl
  }

  Get(): Observable<any> {
    console.log("SERVCIO GET PERSONALES");
    
    return this.http.get<any>(`${this.url}/get-personals`);

  }

  GetPersonal(_id:any): Observable<any> {
    return this.http.get<any>(`${this.url}/get-personal/${_id}`);

  }

  Post(data: any): Observable<any> {
    return this.http.post<any>(`${this.url}/post-personal`, data);
  }

  Put(data: any): Observable<any> {
    return this.http.put<any>(`${this.url}/put-personal`, data);
  }

  Delete(_id: any) {
    return this.http.delete<any>(`${this.url}/delete-personal/${_id}`);
  }
}
