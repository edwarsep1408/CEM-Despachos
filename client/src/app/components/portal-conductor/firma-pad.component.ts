import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-firma-pad",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="firma-box">
      <p class="firma-titulo">{{ titulo }}</p>
      <canvas
        #pad
        class="firma-pad"
        (pointerdown)="empezar($event)"
        (pointermove)="mover($event)"
        (pointerup)="terminar()"
        (pointercancel)="terminar()"
      ></canvas>
      <button type="button" class="firma-borrar" (click)="borrar()">Borrar</button>
    </div>
  `,
})
export class FirmaPadComponent implements AfterViewInit, OnChanges {
  @Input() titulo = "Firma";
  @Input() imagen = "";
  @ViewChild("pad") pad?: ElementRef<HTMLCanvasElement>;

  private dibujando = false;
  private sucio = false;

  ngAfterViewInit() {
    this.preparar();
    if (this.imagen) this.pintar(this.imagen);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["imagen"] && !this.sucio && this.pad?.nativeElement) {
      this.preparar();
      if (this.imagen) this.pintar(this.imagen);
    }
  }

  capturar(): string {
    const canvas = this.pad?.nativeElement;
    if (!canvas) return this.imagen || "";
    if (!this.sucio) return this.imagen || "";
    return canvas.toDataURL("image/png");
  }

  hayFirma(): boolean {
    return this.sucio || Boolean(this.imagen);
  }

  empezar(ev: PointerEvent) {
    ev.preventDefault();
    const canvas = this.pad?.nativeElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(ev.pointerId);
    this.dibujando = true;
    const { x, y } = this.punto(ev, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  mover(ev: PointerEvent) {
    if (!this.dibujando) return;
    const canvas = this.pad?.nativeElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = this.punto(ev, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    this.sucio = true;
  }

  terminar() {
    this.dibujando = false;
    this.pad?.nativeElement.getContext("2d")?.beginPath();
  }

  borrar() {
    this.limpiar();
    this.sucio = false;
    this.imagen = "";
  }

  private preparar() {
    const canvas = this.pad?.nativeElement;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const ancho = Math.max(260, canvas.clientWidth || 320);
    const alto = Math.max(110, canvas.clientHeight || 120);
    canvas.width = Math.round(ancho * ratio);
    canvas.height = Math.round(alto * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    this.limpiar();
  }

  private limpiar() {
    const canvas = this.pad?.nativeElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width / ratio, canvas.height / ratio);
    ctx.beginPath();
  }

  private pintar(data: string) {
    const canvas = this.pad?.nativeElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !data) return;
    const img = new Image();
    img.onload = () => {
      const ratio = window.devicePixelRatio || 1;
      const w = canvas.width / ratio;
      const h = canvas.height / ratio;
      ctx.drawImage(img, 0, 0, w, h);
    };
    img.src = data;
  }

  private punto(ev: PointerEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }
}
