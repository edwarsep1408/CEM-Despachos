import { AfterViewInit, Component, ElementRef, HostListener, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterModule } from "@angular/router";
import Swal from "sweetalert2";
import { FirmantesService } from "../../services/despacho/firmantes.service";
import { PermisosSesion } from "../../core/permisos-sesion";
import { SesionService } from "../../services/sesion/sesion.service";

@Component({
  selector: "app-mi-firma",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./mi-firma.component.html",
  styleUrl: "./mi-firma.component.css",
})
export class MiFirmaComponent implements AfterViewInit {
  nombre = "";
  cargo = "";
  guardando = false;
  cargando = true;
  error = "";
  private dibujando = false;
  private sucio = false;
  private firmaGuardada = "";

  @ViewChild("pad") pad?: ElementRef<HTMLCanvasElement>;

  constructor(
    private firmantes: FirmantesService,
    private sesion: SesionService,
    private router: Router
  ) {}

  ngAfterViewInit() {
    this.firmantes.miFirma().subscribe({
      next: (res) => {
        const body = res.body || {};
        this.nombre = body.nombre || "";
        this.cargo = body.cargoEtiqueta || body.cargo || "";
        this.firmaGuardada = body.firma || "";
        this.cargando = false;
        setTimeout(() => {
          this.prepararPad();
          if (this.firmaGuardada) this.pintar(this.firmaGuardada);
        });
      },
      error: (err) => {
        this.cargando = false;
        this.error = err?.error?.body?.message || "No está habilitado para firmar.";
      },
    });
  }

  @HostListener("window:resize")
  onResize() {
    const canvas = this.pad?.nativeElement;
    const previa = this.sucio && canvas ? canvas.toDataURL("image/png") : this.firmaGuardada;
    this.prepararPad();
    if (previa) this.pintar(previa);
  }

  volver() {
    this.router.navigateByUrl(PermisosSesion.primeraRuta());
  }

  salir() {
    this.sesion.cerrarSesion();
    this.router.navigate(["/login"]);
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
    this.firmaGuardada = "";
  }

  guardar() {
    const canvas = this.pad?.nativeElement;
    if (!canvas || !this.sucio) {
      this.aviso("error", "Dibuje la firma con el dedo o el lápiz.");
      return;
    }
    this.guardando = true;
    this.firmantes.guardarMiFirma(canvas.toDataURL("image/png")).subscribe({
      next: () => {
        this.guardando = false;
        this.sucio = false;
        this.firmaGuardada = canvas.toDataURL("image/png");
        this.aviso("success", "Firma guardada. Se usará en el certificado según su cargo.");
      },
      error: (err) => {
        this.guardando = false;
        this.aviso("error", err?.error?.body?.message || "No se pudo guardar la firma");
      },
    });
  }

  private prepararPad() {
    const canvas = this.pad?.nativeElement;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const ancho = Math.max(280, canvas.clientWidth);
    const alto = Math.max(180, canvas.clientHeight);
    canvas.width = Math.round(ancho * ratio);
    canvas.height = Math.round(alto * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    this.limpiar();
  }

  private limpiar() {
    const canvas = this.pad?.nativeElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.beginPath();
  }

  private pintar(firma: string) {
    const canvas = this.pad?.nativeElement;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
      this.limpiar();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const ratio = window.devicePixelRatio || 1;
      const w = canvas.width / ratio;
      const h = canvas.height / ratio;
      const escala = Math.min(w / img.width, h / img.height);
      const dw = img.width * escala;
      const dh = img.height * escala;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };
    img.src = firma;
  }

  private punto(ev: PointerEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
    };
  }

  private aviso(icon: "success" | "error", title: string) {
    Swal.fire({ toast: true, position: "top", icon, title, showConfirmButton: false, timer: 2800 });
  }
}
