import { Environment } from "./environment.interface";

const host = `${window.location.protocol}//${window.location.hostname}`;

export const environment: Environment = {
  production: true,
  apiUrl: `${host}:3020/api/v1`,
  socketUrl: `${host}:3020`,
  agenteBasculaUrl: "http://127.0.0.1:3920",
};
