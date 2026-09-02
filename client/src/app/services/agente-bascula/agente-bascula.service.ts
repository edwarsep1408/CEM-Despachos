import { Injectable, NgZone } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

export type EstadoBascula = {
  ip?: string;
  puerto?: number;
  conectado?: boolean;
  reconectando?: boolean;
  error?: string | null;
  peso?: number | null;
  trama?: string | null;
  hex?: string | null;
  ts?: number | null;
  tipo?: string;
};

@Injectable({ providedIn: "root" })
export class AgenteBasculaService {
  private url = (environment as { agenteBasculaUrl?: string }).agenteBasculaUrl || "http://127.0.0.1:3920";

  constructor(private http: HttpClient, private zone: NgZone) {}

  estado() {
    return this.http.get<{ body: EstadoBascula }>(`${this.url}/estado`);
  }

  reconectar() {
    return this.http.post<{ body: EstadoBascula }>(`${this.url}/reconectar`, {});
  }

  eventos(): Observable<EstadoBascula> {
    return new Observable((subscriber) => {
      const source = new EventSource(`${this.url}/eventos`);
      source.onmessage = (event) => {
        this.zone.run(() => {
          try {
            subscriber.next(JSON.parse(event.data));
          } catch (_error) {
            /* ignore */
          }
        });
      };
      source.onerror = () => {
        this.zone.run(() => subscriber.error(new Error("No hay conexión con el agente local.")));
        source.close();
      };
      return () => source.close();
    });
  }
}
