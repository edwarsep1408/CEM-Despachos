export interface Environment {
  production: boolean;
  apiUrl: string;
  socketUrl: string;
  agenteBasculaUrl?: string;
  ssoEnabled?: boolean;
}
