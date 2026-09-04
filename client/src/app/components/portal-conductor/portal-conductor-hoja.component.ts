import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import { ConductorService } from "../../services/despacho/conductor.service";
import { SesionService } from "../../services/sesion/sesion.service";
import Swal from "sweetalert2";

@Component({
  selector: "app-portal-conductor-hoja",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./portal-conductor-hoja.component.html",
  styleUrl: "./portal-conductor.css",
})
export class PortalConductorHojaComponent implements OnInit {
  cargando = true;
  error = "";
  placa = "";
  conductor = "";
  hojas: any[] = [];
  hoja: any = null;
  guardando = false;
  leyendo = false;
  form = {
    banco: "Bancolombia",
    valor: null as number | null,
    referencia: "",
    foto: "",
    gastosOperativos: 0,
    monedas: 0,
    observaciones: "",
  };

  constructor(
    private api: ConductorService,
    private sesion: SesionService,
    private router: Router
  ) {}

  ngOnInit() {
    this.api.getHojas().subscribe({
      next: (res) => {
        const body = res?.body || {};
        this.placa = body.placa || localStorage.getItem("placa") || "";
        this.conductor = body.conductor || localStorage.getItem("user") || "";
        this.hojas = body.hojas || [];
        this.hoja = this.hojas[0] || null;
        this.aplicarHoja();
        this.cargando = false;
      },
      error: (err) => {
        this.error = err?.error?.body?.message || "No se pudo leer la hoja de ruta.";
        this.cargando = false;
      },
    });
  }

  get cruce() {
    return this.hoja?.cruce || this.hoja?.liquidacion || {};
  }

  get bancos() {
    return this.hoja?.bancos || [{ codigo: "Bancolombia", nombre: "Bancolombia" }];
  }

  get enRuta() {
    return this.hoja?.estado === "vigente";
  }

  get cerrada() {
    return this.hoja?.estado === "cerrada";
  }

  get liquidada() {
    return this.hoja?.estado === "liquidada" || this.estadoLiq === "paz_y_salvo";
  }

  get estadoLiq() {
    return this.hoja?.liquidacion?.estado || "sin_liquidar";
  }

  get puedeConsignar() {
    return this.cerrada && this.estadoLiq !== "paz_y_salvo" && this.estadoLiq !== "pendiente";
  }

  get puedeEnviar() {
    return this.cerrada && (this.estadoLiq === "sin_liquidar" || this.estadoLiq === "rechazada");
  }

  get pendientes() {
    return (this.hoja?.facturas || []).filter(
      (d: any) => String(d.entrega?.estado || "pendiente") === "pendiente"
    ).length;
  }

  etiquetaEstado(estado: string) {
    const e = String(estado || "pendiente").toLowerCase();
    if (e === "entregado") return "Entregada";
    if (e === "parcial") return "Parcial";
    if (e === "no_entregado") return "No entregada";
    return "Pendiente";
  }

  etiquetaRecaudo(rec: any) {
    const e = String(rec?.estado || "");
    if (e === "cuadrado") return "cuadra con la factura";
    if (e === "falta") return `faltan ${(rec.diferencia || 0).toLocaleString("es-CO")}`;
    if (e === "exceso") return `sobran ${Math.abs(rec.diferencia || 0).toLocaleString("es-CO")}`;
    if (e === "no_aplica") return "no aplica";
    return "sin recaudo";
  }

  etiquetaRuta() {
    if (this.liquidada) return "Paz y salvo";
    if (this.estadoLiq === "pendiente") return "Pendiente de aprobación";
    if (this.estadoLiq === "rechazada") return "Liquidación rechazada";
    if (this.cerrada) return "Ruta cerrada";
    return "En ruta";
  }

  abrir(doc: any) {
    if (!this.hoja?._id || !doc?.docId) return;
    this.router.navigate(["/portal-conductor", this.hoja._id, doc.docId]);
  }

  elegirHoja(h: any) {
    this.hoja = h;
    this.aplicarHoja();
  }

  aplicarHoja() {
    const liq = this.hoja?.liquidacion || {};
    this.form.gastosOperativos = Number(liq.gastosOperativos) || 0;
    this.form.monedas = Number(liq.monedas) || 0;
    this.form.observaciones = liq.observaciones || "";
    this.form.banco = this.bancos[0]?.codigo || "Bancolombia";
    this.form.valor = null;
    this.form.referencia = "";
    this.form.foto = "";
  }

  aplicarRespuesta(body: any) {
    if (!body?._id) return;
    this.hoja = body;
    this.hojas = this.hojas.map((h) => (h._id === body._id ? body : h));
    this.aplicarHoja();
  }

  async cerrarRuta() {
    if (!this.hoja?._id || this.guardando) return;
    if (this.pendientes) {
      Swal.fire({
        icon: "warning",
        title: "Hay facturas pendientes",
        text: `Complete las ${this.pendientes} entrega(s) antes de cerrar la ruta.`,
      });
      return;
    }
    const ok = await Swal.fire({
      icon: "question",
      title: "Cerrar ruta",
      text: "No podrá editar entregas después de cerrar. ¿Continuar?",
      showCancelButton: true,
      confirmButtonText: "Cerrar ruta",
      cancelButtonText: "Cancelar",
    });
    if (!ok.isConfirmed) return;
    this.guardando = true;
    this.api.cerrarRuta(this.hoja._id).subscribe({
      next: (res) => {
        this.guardando = false;
        this.aplicarRespuesta(res?.body);
        Swal.fire({ icon: "success", title: "Ruta cerrada", timer: 1400, showConfirmButton: false });
      },
      error: (err) => {
        this.guardando = false;
        Swal.fire({
          icon: "error",
          title: "No se pudo cerrar",
          text: err?.error?.body?.message || "Intente de nuevo.",
        });
      },
    });
  }

  async onFoto(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      this.leyendo = true;
      this.form.foto = await this.comprimirFoto(file);
      this.api.leerComprobante(this.form.foto).subscribe({
        next: (res) => {
          this.leyendo = false;
          const body = res?.body || {};
          if (Number(body.monto) > 0) this.form.valor = Number(body.monto);
          if (body.referencia) this.form.referencia = String(body.referencia);
          if (body.banco) this.form.banco = body.banco;
        },
        error: () => {
          this.leyendo = false;
        },
      });
    } catch {
      this.leyendo = false;
      Swal.fire({ icon: "error", title: "No se pudo leer la foto", text: "Intente de nuevo." });
    }
  }

  agregarConsignacion() {
    if (!this.hoja?._id || this.guardando) return;
    if (!this.form.valor || !this.form.referencia || !this.form.foto) {
      Swal.fire({
        icon: "warning",
        title: "Faltan datos",
        text: "Valor, referencia y foto son obligatorios.",
      });
      return;
    }
    this.guardando = true;
    this.api
      .agregarConsignacion(this.hoja._id, {
        banco: this.form.banco,
        valor: this.form.valor,
        referencia: this.form.referencia,
        foto: this.form.foto,
      })
      .subscribe({
        next: (res) => {
          this.guardando = false;
          this.aplicarRespuesta(res?.body);
        },
        error: (err) => {
          this.guardando = false;
          Swal.fire({
            icon: "error",
            title: "No se agregó",
            text: err?.error?.body?.message || "Intente de nuevo.",
          });
        },
      });
  }

  quitarConsignacion(row: any) {
    if (!this.hoja?._id || !row?._id || this.guardando) return;
    this.guardando = true;
    this.api.eliminarConsignacion(this.hoja._id, row._id).subscribe({
      next: (res) => {
        this.guardando = false;
        this.aplicarRespuesta(res?.body);
      },
      error: (err) => {
        this.guardando = false;
        Swal.fire({
          icon: "error",
          title: "No se borró",
          text: err?.error?.body?.message || "Intente de nuevo.",
        });
      },
    });
  }

  enviarLiquidacion() {
    if (!this.hoja?._id || this.guardando) return;
    this.guardando = true;
    this.api
      .enviarLiquidacion(this.hoja._id, {
        gastosOperativos: this.form.gastosOperativos,
        monedas: this.form.monedas,
        observaciones: this.form.observaciones,
      })
      .subscribe({
        next: (res) => {
          this.guardando = false;
          this.aplicarRespuesta(res?.body);
          Swal.fire({
            icon: "success",
            title: "Enviado a liquidar",
            text: "Oficina revisará el paz y salvo.",
          });
        },
        error: (err) => {
          this.guardando = false;
          Swal.fire({
            icon: "error",
            title: "No se envió",
            text: err?.error?.body?.message || "Intente de nuevo.",
          });
        },
      });
  }

  private comprimirFoto(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("archivo"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("imagen"));
        img.onload = () => {
          const max = 1600;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("canvas"));
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          let data = canvas.toDataURL("image/jpeg", 0.8);
          if (data.length > 850000) data = canvas.toDataURL("image/jpeg", 0.55);
          resolve(data);
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  salir() {
    this.sesion.cerrarSesion();
    this.router.navigateByUrl("/login-conductor");
  }
}
