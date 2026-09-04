import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { LiquidacionService } from "../../../services/despacho/liquidacion.service";
import Swal from "sweetalert2";

type Tab = "cierre" | "liquidacion" | "avance" | "historico";

@Component({
  selector: "app-cierre-liquidacion",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./cierre-liquidacion.component.html",
  styleUrls: ["../despacho-page.css", "./cierre-liquidacion.component.css"],
})
export class CierreLiquidacionComponent implements OnInit, OnDestroy {
  tab: Tab = "cierre";
  fecha = this.hoy();
  bodega = "TODOS";
  cargando = false;
  guardando = false;
  hojas: any[] = [];
  centros: any[] = [];
  motivos: any[] = [];
  bancos: any[] = [];
  seleccion: any = null;
  avance: any = null;
  historico: any = null;
  placaHist = "TODAS";
  form = {
    banco: "Bancolombia",
    valor: null as number | null,
    referencia: "",
    foto: "",
    gastosOperativos: 0,
    monedas: 0,
    observaciones: "",
  };
  private poll: ReturnType<typeof setInterval> | null = null;

  constructor(private api: LiquidacionService) {}

  ngOnInit() {
    this.cargarHojas();
  }

  ngOnDestroy() {
    this.detenerPoll();
  }

  hoy() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  ir(tab: Tab) {
    this.tab = tab;
    if (tab === "avance") {
      this.cargarAvance();
      this.iniciarPoll();
    } else {
      this.detenerPoll();
    }
    if (tab === "historico") this.cargarHistorico();
    if (tab === "cierre" || tab === "liquidacion") this.cargarHojas();
  }

  cambiarFecha() {
    this.seleccion = null;
    if (this.tab === "avance") this.cargarAvance();
    else if (this.tab === "historico") this.cargarHistorico();
    else this.cargarHojas();
  }

  get visibles() {
    if (this.bodega === "TODOS") return this.hojas;
    return this.hojas.filter((h) => h.centro === this.bodega || h.centroNombre === this.bodega);
  }

  countCentro(c: any) {
    if (!c || c.codigo === "TODOS") return this.hojas.length;
    return this.hojas.filter((h) => h.centro === c.codigo || h.centroNombre === c.nombre).length;
  }

  get cruce() {
    return this.seleccion?.cruce || this.seleccion?.liquidacion || {};
  }

  get rutaFinalizada() {
    return this.seleccion?.estado === "cerrada" || this.seleccion?.estado === "liquidada";
  }

  get finalizadaUi() {
    if (this.seleccion?._finalizadaEdicion != null) return this.seleccion._finalizadaEdicion;
    return this.rutaFinalizada;
  }

  etiquetaEstado(estado: string) {
    const e = String(estado || "pendiente").toLowerCase();
    if (e === "entregado") return "ENTREGADO";
    if (e === "parcial") return "PARCIAL";
    if (e === "no_entregado") return "NO ENTREGADO";
    return "-";
  }

  etiquetaLiq(estado: string) {
    const e = String(estado || "sin_liquidar");
    if (e === "paz_y_salvo") return "Paz y salvo";
    if (e === "pendiente") return "Sin liquidar / pendiente";
    if (e === "rechazada") return "Rechazada";
    return "Sin liquidar";
  }

  cargarHojas() {
    this.cargando = true;
    this.api.hojas(this.fecha, "").subscribe({
      next: (res) => {
        const body = res?.body || {};
        this.hojas = body.hojas || [];
        this.centros = body.centros || [{ codigo: "TODOS", nombre: "TODOS" }];
        this.motivos = body.motivos || [];
        this.bancos = body.bancos || [];
        if (this.seleccion) {
          const hit = this.hojas.find((h) => h._id === this.seleccion._id);
          this.seleccion = hit || this.visibles[0] || null;
        } else {
          this.seleccion = this.visibles[0] || null;
        }
        if (this.tab === "liquidacion" && this.seleccion) this.abrirDetalle(this.seleccion);
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        this.toast("error", err?.error?.body?.message || "No se pudieron leer las rutas.");
      },
    });
  }

  elegir(h: any) {
    this.seleccion = h;
    if (this.tab === "liquidacion") this.abrirDetalle(h);
  }

  abrirDetalle(h: any) {
    this.api.hoja(h._id).subscribe({
      next: (res) => {
        this.seleccion = res?.body || h;
        const liq = this.seleccion.liquidacion || {};
        this.form.gastosOperativos = Number(liq.gastosOperativos) || 0;
        this.form.monedas = Number(liq.monedas) || 0;
        this.form.observaciones = liq.observaciones || "";
        this.form.banco = this.bancos[0]?.codigo || "Bancolombia";
        this.form.valor = null;
        this.form.referencia = "";
        this.form.foto = "";
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo abrir el detalle."),
    });
  }

  guardarCierre() {
    if (!this.seleccion?._id || this.guardando) return;
    this.guardando = true;
    this.api
      .guardarCierre(this.seleccion._id, {
        rutaFinalizada: this.finalizadaUi,
        documentos: (this.seleccion.facturas || []).map((f: any) => ({
          docId: f.docId,
          estado: f.estado,
          motivo: f.motivo,
          observacion: f.observacion,
        })),
      })
      .subscribe({
        next: (res) => {
          this.guardando = false;
          this.seleccion = res?.body || this.seleccion;
          this.cargarHojas();
          this.toast("success", "Cierre guardado.");
        },
        error: (err) => {
          this.guardando = false;
          this.toast("error", err?.error?.body?.message || "No se pudo guardar.");
        },
      });
  }

  async onFoto(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      this.form.foto = await this.comprimirFoto(file);
    } catch {
      this.toast("error", "No se pudo leer la foto.");
    }
  }

  agregarConsignacion() {
    if (!this.seleccion?._id || this.guardando) return;
    if (!this.form.valor || !this.form.referencia || !this.form.foto) {
      this.toast("warning", "Valor, referencia y foto son obligatorios.");
      return;
    }
    this.guardando = true;
    this.api
      .agregarConsignacion(this.seleccion._id, {
        banco: this.form.banco,
        valor: this.form.valor,
        referencia: this.form.referencia,
        foto: this.form.foto,
      })
      .subscribe({
        next: (res) => {
          this.guardando = false;
          this.seleccion = res?.body;
          this.form.valor = null;
          this.form.referencia = "";
          this.form.foto = "";
        },
        error: (err) => {
          this.guardando = false;
          this.toast("error", err?.error?.body?.message || "No se agregó.");
        },
      });
  }

  quitarConsignacion(row: any) {
    if (!this.seleccion?._id || !row?._id || this.guardando) return;
    this.guardando = true;
    this.api.eliminarConsignacion(this.seleccion._id, row._id).subscribe({
      next: (res) => {
        this.guardando = false;
        this.seleccion = res?.body;
      },
      error: (err) => {
        this.guardando = false;
        this.toast("error", err?.error?.body?.message || "No se borró.");
      },
    });
  }

  guardarGastos() {
    if (!this.seleccion?._id || this.guardando) return;
    this.guardando = true;
    this.api
      .guardarGastos(this.seleccion._id, {
        gastosOperativos: this.form.gastosOperativos,
        monedas: this.form.monedas,
        observaciones: this.form.observaciones,
      })
      .subscribe({
        next: (res) => {
          this.guardando = false;
          this.seleccion = res?.body;
        },
        error: (err) => {
          this.guardando = false;
          this.toast("error", err?.error?.body?.message || "No se guardaron los gastos.");
        },
      });
  }

  aprobar() {
    if (!this.seleccion?._id || this.guardando) return;
    this.guardando = true;
    this.api
      .aprobar(this.seleccion._id, {
        gastosOperativos: this.form.gastosOperativos,
        monedas: this.form.monedas,
        observaciones: this.form.observaciones,
      })
      .subscribe({
        next: (res) => {
          this.guardando = false;
          this.seleccion = res?.body;
          this.cargarHojas();
          this.toast("success", "Liquidación aprobada.");
        },
        error: (err) => {
          this.guardando = false;
          this.toast("error", err?.error?.body?.message || "No se pudo aprobar.");
        },
      });
  }

  rechazar() {
    if (!this.seleccion?._id || this.guardando) return;
    this.guardando = true;
    this.api.rechazar(this.seleccion._id, { observaciones: this.form.observaciones }).subscribe({
      next: (res) => {
        this.guardando = false;
        this.seleccion = res?.body;
        this.cargarHojas();
        this.toast("success", "Liquidación rechazada.");
      },
      error: (err) => {
        this.guardando = false;
        this.toast("error", err?.error?.body?.message || "No se pudo rechazar.");
      },
    });
  }

  cargarAvance() {
    this.cargando = true;
    this.api.avance(this.fecha).subscribe({
      next: (res) => {
        this.avance = res?.body || null;
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        this.toast("error", err?.error?.body?.message || "No se pudo leer el avance.");
      },
    });
  }

  cargarHistorico() {
    this.cargando = true;
    this.api.historico(this.fecha, this.placaHist === "TODAS" ? "" : this.placaHist).subscribe({
      next: (res) => {
        this.historico = res?.body || null;
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        this.toast("error", err?.error?.body?.message || "No se pudo leer el histórico.");
      },
    });
  }

  verFoto(foto: string) {
    if (!foto) return;
    Swal.fire({
      imageUrl: foto,
      imageAlt: "Consignación",
      width: 640,
      showConfirmButton: false,
      showCloseButton: true,
    });
  }

  horaDe(fecha: string | Date | null) {
    if (!fecha) return "";
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  }

  private iniciarPoll() {
    this.detenerPoll();
    this.poll = setInterval(() => this.cargarAvance(), 30000);
  }

  private detenerPoll() {
    if (this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
  }

  private toast(icon: "success" | "error" | "warning", title: string) {
    Swal.fire({ icon, title, timer: icon === "success" ? 1400 : undefined, showConfirmButton: icon !== "success" });
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
}
