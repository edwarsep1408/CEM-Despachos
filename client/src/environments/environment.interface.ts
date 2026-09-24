export interface Environment {
  production: boolean;
  apiUrl: string;
  socketUrl: string;
  agenteBasculaUrl?: string;
  /** En muelle: true (PC → agente → TSC). En local: false (API → TSC). */
  impresoraViaAgente?: boolean;
  ssoEnabled?: boolean;
}
