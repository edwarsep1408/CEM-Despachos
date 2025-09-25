import { Injectable } from '@angular/core';
import { environment } from "../../../environments/environment";
import { io } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketService {

  url: any
  socket: any;
  private latencyThreshold: number = 5000;

  private isConnectedSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public isConnected$: Observable<boolean> = this.isConnectedSubject.asObservable();
/*       transports: ['websocket', 'polling', 'flashsocket'],
      timeout: 5000,

      autoConnect: true */
  constructor() {
    this.url = environment.socketUrl
    this.socket = io(this.url, {
      transports: ['websocket', 'polling', 'flashsocket'],
      timeout: 5000,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 1000,
      autoConnect: true
    });
    // Escuchar eventos de conexión y desconexión
    this.socket.on('connect', () => this.handleConnection(true));
    this.socket.on('disconnect', () => this.handleConnection(false));
  }

  // Método privado para manejar cambios de conexión
  private handleConnection(connected: boolean): void {
    this.isConnectedSubject.next(connected);

    if (!connected) {
      console.log('Desconectado del servidor. Activando Plan B.');
    } else {
      console.log('Conectado al servidor. Desactivando Plan B.');
    }
  }

  // Método para verificar el estado de la conexión
  isConnected(): boolean {
    return this.socket.connected;
  }

  emitSocket(event: any, data: any) {
    this.socket.emit(event, data);
  }

  eventOnSubscribedRoom() {
    return new Observable(observer => {
      this.socket.on('subcribed-room', (msg: any) => {
        observer.next(msg);
      });
    });
  }

  eventOnNewPlanilla() {
    return new Observable(observer => {
      this.socket.on('nueva-planilla', (msg: any) => {
        observer.next(msg);
      });
    });
  }

  eventOnPlanillaFinalizada() {
    return new Observable(observer => {
      this.socket.on('planilla-finalizada', (msg: any) => {
        observer.next(msg);
      });
    });
  }

  eventOnPlanillaFirmar() {
    return new Observable(observer => {
      this.socket.on('firmar-planilla', (msg: any) => {
        observer.next(msg);
      });
    });
  }

  eventOnPlanillaNewFirma() {
    return new Observable(observer => {
      this.socket.on('nueva-firma-planilla', (msg: any) => {
        observer.next(msg);
      });
    });
  }

  eventOnDiferencias() {
    return new Observable(observer => {
      this.socket.on('diferencia', (msg: any) => {
        observer.next(msg);
      });
    });
  }

  eventOnActualizarConteo() {
    return new Observable(observer => {
      this.socket.on('actualizar-conteo', (msg: any) => {
        observer.next(msg);
      });
    });
  }

  eventOnActualizarConteoAdmin() {
    return new Observable(observer => {
      this.socket.on('actualizar-conteo-admin', (msg: any) => {
        observer.next(msg);
      });
    });
  }

  eventOnUsuarioNuevoConteo() {
    return new Observable(observer => {
      this.socket.on('usersInRoom', (msg: any) => {
        observer.next(msg);
      });
    });
  }

  eventOnUsuarioDisconnectedConteo() {
    return new Observable(observer => {
      this.socket.on('userDisconnected', (msg: any) => {
        observer.next(msg);
      });
    });
  }

  eventOnAlertaResetBasucla() {
    return new Observable(observer => {
      this.socket.on('alerta-reset-bascula', (msg: any) => {
        observer.next(msg);
      });
    });
  }


  public measureLatency(): Observable<number> {
    const startTime = Date.now();
    return new Observable(observer => {
      this.socket.emit('latencyTest', startTime); // Envía un mensaje al servidor para medir la latencia
      this.socket.on('latencyResponse', (responseTime: number) => {
        const latency = responseTime - startTime; // Calcula la latencia
        observer.next(latency);
      });
    });
  }

  public checkLatency(): void {
    this.measureLatency().subscribe(latency => {
      if (latency > this.latencyThreshold) {
        console.log('Latencia alta detectada:', latency);
        // Aquí puedes tomar medidas, como reconectar o cambiar al plan B
      } else {
        console.log('Latencia aceptable:', latency);
      }
    });
  }

}
