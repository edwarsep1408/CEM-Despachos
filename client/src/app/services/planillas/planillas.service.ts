import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from "../../../environments/environment";

import { download, Download } from "../dowload.service";
import { SAVER, Saver } from '../saver.provider'

@Injectable({
  providedIn: 'root'
})
export class PlanillasService {

  private url: string

  constructor(private http: HttpClient, @Inject(SAVER) private save: Saver) {
    this.url = environment.apiUrl
  }

  Get(mesa: any, bodega: any ): Observable<any> {
    return this.http.get<any>(`${this.url}/get-planilla-inventario/${mesa}/${bodega}`);
  }
  GetResumenFilter(mesa: any): Observable<any> {
    return this.http.get<any>(`${this.url}/get-planilla-resumen-inventario/${mesa}`);
  }

  GetResumen(): Observable<any> {
    return this.http.get<any>(`${this.url}/get-planilla-resumen-inventario`);
  }

  GetResumenTotal(planilla: any): Observable<any> {
    return this.http.get<any>(`${this.url}/get-planilla-resumen-total/${planilla}`);
  }

  GetResumenExcel(bodega: any, ano: any, fecha: any, filename: any): Observable<Download> {
    console.log(bodega,ano, fecha, "INFORMACION PARA CONSULTAR");
    return this.http.get(`${this.url}/get-planilla-resumen-inventario-excel/${bodega}/${ano}/${fecha}`, { reportProgress: true, observe: 'events', responseType: 'blob' }).pipe(download(blob => this.save(blob, filename)))

  }

  Post(data: any): Observable<any> {
    return this.http.post<any>(`${this.url}/post-planilla-inventario`, data);
  }

  GetValidate(planilla: any, mesa: any): Observable<any> {
    return this.http.get<any>(`${this.url}/get-validar-firmas/${planilla}/${mesa}`);
  }

  GetEventPlanilla(planilla: any, mesa: any): Observable<any> {
    return this.http.get<any>(`${this.url}/get-eventos-planilla/${planilla}/${mesa}`);
  }

  /* ESTE CÓDIGO HACE PARTE DE LA VERSIÓN 1.0.0 QUE LO HIZO JUANCA ESTE INVENTARIO NO TIENE FILTRO A LA HORA DE HACER CÁLCULOS . TOMA TODA LA INFORMACIÓN QUE HAY EN LA BASE DE DATOS  */
/*   GetInventarioDashBoard(bodega?: any, ano?: any, fecha?: any): Observable<any> {
    
    let apiUrl = `${this.url}/get-dashboard-resumen-inventario`;
    
    if (bodega || ano || fecha) {
      apiUrl += `/${bodega || ''}/${ano || ''}/${fecha || ''}`;
    }    
    // Enviar la solicitud HTTP GET
    return this.http.get<any>(apiUrl);
  } */

  GetInventarioDashBoardByPlanillas(bodega?: any, ano?: any, fecha?: any): Observable<any> {
    
    let apiUrl = `${this.url}/get-dashboard-resumen-inventario-byPlanillas`;
    
    if (bodega || ano || fecha) {
      apiUrl += `/${bodega || ''}/${ano || ''}/${fecha || ''}`;
    }    
    
    // Enviar la solicitud HTTP GET
    return this.http.get<any>(apiUrl);
  }

  GetYearsFilter(bodega?: any): Observable<any> {
    return this.http.get<any>(`${this.url}/get-years-filter-planillas/${bodega}`);
  }

  GetMonthFilter(bodega: any, ano: any): Observable<any> {
    return this.http.get<any>(`${this.url}/get-month-filter-planillas/${bodega}/${ano}`);
  }

  PostValidarFirma(data: any): Observable<any> {

    return this.http.post<any>(`${this.url}/post-finalizar-planilla-inventario`, data);

  }

  GetPlanillasPorBodega(bodegaId: any):Observable<any>{
    console.log(bodegaId,"<---- BODEGA");

    let parametros= new HttpParams().set('bodega', bodegaId);
    return this.http.get<any>(`${this.url}/get-planillasporbodega`, {params: parametros});
    
  }

  GetExcelInventario(planillaInformacion: any):Observable<Download> {

    const {_id, bodega, fecha_inventario, fecha_formateada} = planillaInformacion;
    return this.http.get(`${this.url}/get-planilla-inventarioSeleccionado-excel/${_id}/${bodega}/${fecha_inventario}`, {reportProgress:true, observe : 'events', responseType:'blob' }).pipe(download(blob => this.save(blob, `${fecha_formateada}-Inventario`)));
    
  }

  GetExcelInventarioRevisoriaFiscal(planillaInformacion: any): Observable<any>{
    
    const {_id, bodega, fecha_inventario, fecha_formateada} = planillaInformacion;
    
    return this.http.get(`${this.url}/get-planilla-inventario-revisoria-fiscal-excel/${_id}/${bodega}/${fecha_inventario}`,  {reportProgress:true, observe : 'events', responseType:'blob' }).pipe(download(blob => this.save(blob, `${fecha_formateada}-Inventario-mesa`)));
    
  }

  GetExcelInventario_por_mesayconteo(planillaInformacion: any): Observable<any>{
    
    const {_id, bodega, fecha_inventario, fecha_formateada} = planillaInformacion;
    
    return this.http.get(`${this.url}/get-planilla-inventario-detallado-mesayconteo/${_id}/${bodega}/${fecha_inventario}`,  {reportProgress:true, observe : 'events', responseType:'blob' }).pipe(download(blob => this.save(blob, `${fecha_formateada}-Inventario-mesa-conteo`)));
    
    
    /* return this.http.get(`${this.url}/get-planilla-inventario-detallado-mesayconteo/${_id}/${bodega}/${fecha_inventario}`); */
  }


}
