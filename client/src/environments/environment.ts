import { Socket } from "socket.io-client";

 export const environment = {
  production: false,
  /* original proyecto */
  /*
  apiUrl: 'http://localhost:3001/api/v1',
  socketUrl: 'http://localhost:3001'
   */
  apiUrl: `http://${window.location.hostname}:3020/api/v1`,
  socketUrl: `http://${window.location.hostname}:3020`,
  agenteBasculaUrl: 'http://127.0.0.1:3920'
  /* apiUrl: 'http://localhost:4200/api/v1',
  socketUrl: 'http://localhost:4200' */
};


