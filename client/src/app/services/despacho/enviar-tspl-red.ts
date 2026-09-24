import { Observable, catchError, throwError } from "rxjs";
import { environment } from "../../../environments/environment";
import { AgenteBasculaService } from "../agente-bascula/agente-bascula.service";
import { PisoService } from "./piso.service";

/**
 * Local (impresoraViaAgente=false): API → TSC en LAN.
 * Piso (true): agente :3920 → TSC; si el agente no responde, fallback al API.
 */
export const enviarTsplRed = (
  tsplBase64: string,
  deps: { piso: PisoService; agente: AgenteBasculaService }
): Observable<any> => {
  const viaAgente = environment.impresoraViaAgente !== false;
  if (!viaAgente) {
    return deps.piso.imprimirTspl({ tsplBase64 });
  }
  return deps.agente.imprimirTspl({ tsplBase64 }).pipe(
    catchError((err) => {
      const offline =
        err?.status === 0 ||
        /Failed to fetch|Http failure|ERR_CONNECTION/i.test(String(err?.message || ""));
      if (!offline) return throwError(() => err);
      return deps.piso.imprimirTspl({ tsplBase64 });
    })
  );
};
