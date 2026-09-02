import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class HojasRutaService {
  private url = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listar(filtros: { estado?: string; desde?: string; hasta?: string; nombre?: string; placa?: string }): Observable<any> {
    let params = new HttpParams();
    Object.entries(filtros || {}).forEach(([key, value]) => {
      if (value) params = params.set(key, String(value));
    });
    return this.http.get(`${this.url}/get-hojas-ruta`, { params });
  }

  impresion(_id: string): Observable<any> {
    return this.http.get(`${this.url}/get-hoja-ruta-impresion/${_id}`);
  }

  get(_id: string): Observable<any> {
    return this.http.get(`${this.url}/get-hoja-ruta/${_id}`);
  }

  vehiculos(): Observable<any> {
    return this.http.get(`${this.url}/get-vehiculos`);
  }

  crear(data: {
    nombre: string;
    placa: string;
    fecha?: string;
    pesoAdicional?: number | null;
    temperatura?: string;
    firmanteCalidadId?: string;
    firmanteLogisticaId?: string;
  }): Observable<any> {
    return this.http.post(`${this.url}/post-hoja-ruta`, data);
  }

  disponibles(hojaId: string): Observable<any> {
    return this.http.get(`${this.url}/get-documentos-hoja-ruta`, { params: { hojaId } });
  }

  facturas(filtros: {
    hojaId?: string;
    desde?: string;
    hasta?: string;
    nit?: string;
    razon_social?: string;
    contacto?: string;
    barrio?: string;
    municipio?: string;
    num_factura?: string;
    tipo_doc?: string;
    bodega?: string;
    vendedor?: string;
    refrescar?: string;
  }): Observable<any> {
    let params = new HttpParams();
    Object.entries(filtros || {}).forEach(([key, value]) => {
      if (value) params = params.set(key, String(value));
    });
    return this.http.get(`${this.url}/get-facturas-siesa`, { params });
  }

  agregar(payload: { _id: string; items: Array<{ pedidoIdEnc: string; nroFactura: string }> }): Observable<any> {
    return this.http.put(`${this.url}/put-hoja-ruta-documentos`, payload);
  }

  agregarFactura(payload: { _id: string; factura: string }): Observable<any> {
    return this.http.put(`${this.url}/put-hoja-ruta-factura`, payload);
  }

  agregarFacturas(payload: { _id: string; items: Array<{ numFactura: string }> }): Observable<any> {
    return this.http.put(`${this.url}/put-hoja-ruta-facturas`, payload);
  }

  actualizar(payload: any): Observable<any> {
    return this.http.put(`${this.url}/put-hoja-ruta`, payload);
  }

  quitar(payload: { _id: string; ids: string[] }): Observable<any> {
    return this.http.put(`${this.url}/put-hoja-ruta-eliminar-documentos`, payload);
  }

  confirmar(_id: string): Observable<any> {
    return this.http.put(`${this.url}/put-hoja-ruta-confirmar/${_id}`, {});
  }

  anular(_id: string): Observable<any> {
    return this.http.put(`${this.url}/put-hoja-ruta-anular/${_id}`, {});
  }
}
