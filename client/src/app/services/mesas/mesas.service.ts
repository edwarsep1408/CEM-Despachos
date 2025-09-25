import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { Observable } from 'rxjs'
import { environment } from "../../../environments/environment";
import { map } from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class MesasService {

  url: any

  constructor(private http: HttpClient) {
    this.url = environment.apiUrl
  }

  Get(): Observable<any>{
    return this.http.get(`${this.url}/get-mesas`).pipe(map((res: any)=>res));

  }

  GetMesaBodega(bodega: any): Observable<any>{
    return this.http.get(`${this.url}/get-mesa-bodega/${bodega}`).pipe(map((res: any)=>res));

  }

  Post(data :any) :Observable <any>{
    return this.http.post(`${this.url}/post-mesa`, data).pipe(map((res: any)=>res));
  }

  Put(data :any) :Observable <any>{
    return this.http.put(`${this.url}/put-mesa`, data).pipe(map((res: any)=>res));
  }

  Delete(_id: any){
    return this.http.delete(`${this.url}/delete-mesa/${_id}`).pipe(map((res: any)=>res));
  }
}
