import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: 'root'
})
export class BodegasService { 


  private url: string

  constructor(private http: HttpClient) {
    this.url = environment.apiUrl
    
  }

  Get(): Observable<any> {
    
    return this.http.get<any>(`${this.url}/get-bodegas`);

  }

  Post(data: any): Observable<any> {
    
    return this.http.post<any>(`${this.url}/post-bodega`, data);
  }

  Put(data: any): Observable<any> {
    return this.http.put<any>(`${this.url}/put-bodega`, data);
  }

  Delete(_id: any) {
    return this.http.delete<any>(`${this.url}/delete-bodega/${_id}`);
  }

  consultarInventarioxBodega(bodega:any){

    console.log(bodega, "<- service");
    
    return this.http.get<any>(`${this.url}/consultarInventarioBodega/${bodega}`);

  }

  consultarInventarioTotalCompania(){
    return this.http.get<any>(`${this.url}/inventarioTotalcompania`);
  }

  consultarInventarioTransito(){
    return this.http.get<any>(`${this.url}/inventarioTransito`);
  }

  onConsultarBodegas(){

    return this.http.get<any>(`${this.url}/get-bodegas-inventario`);

  }
  
}
