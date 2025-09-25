import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from 'rxjs'
import { environment } from '../../../environments/environment';
import { map } from "rxjs/operators";
 
@Injectable({
  providedIn: 'root'
})
export class ItemsService {

  url: any

  constructor(private http: HttpClient) {
    this.url = environment.apiUrl
  }

  Get(): Observable<any>{
    return this.http.get(`${this.url}/get-items`).pipe(map((res: any)=>res));

  }

  GetSearch(searchTerm: any): Observable<any>{
    return this.http.post(`${this.url}/get-items-search`, {searchTerm}).pipe(map((res: any)=>res));
  }

  GetTipo(tipo: any): Observable<any>{
    return this.http.post(`${this.url}/get-items-tipo/`, tipo).pipe(map((res: any)=>res));

  }

  Post(file :any) :Observable <any>{
    const dataInfo = new FormData();

    if (file) {
      dataInfo.append('cargarExcel', file, file.name);
    }



    return this.http.post(`${this.url}/post-sincronzacionExcel`, dataInfo).pipe(map((res: any)=>res));
  }

  Put(data :any) :Observable <any>{
    return this.http.put(`${this.url}/put-item`, data).pipe(map((res: any)=>res));
  }

  Delete(_id: any){
    return this.http.delete(`${this.url}/delete-item/${_id}`).pipe(map((res: any)=>res));
  }

  onSincronizarReferenciasunoee(usuario: any){
    let params = new HttpParams()
    .set('usuario', usuario);
    return this.http.get(`${this.url}/sincronizar-referencias-unoee`, {params }).pipe(map((res: any)=>res));
  }

  onInformacionUltimaSincronizacion(){

    return this.http.get(`${this.url}/informacion-ultima-sincronizacion-items`).pipe(map((res: any)=>res));

  }


}
