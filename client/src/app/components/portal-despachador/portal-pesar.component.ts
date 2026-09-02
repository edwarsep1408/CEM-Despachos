import { Component, ElementRef, HostListener, OnDestroy, OnInit, QueryList, ViewChildren } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { Subscription } from "rxjs";
import Swal from "sweetalert2";
import { environment } from "../../../environments/environment";
import { PisoService } from "../../services/despacho/piso.service";
import { TarasEmpaquesService } from "../../services/despacho/taras-empaques.service";
import { BasculasService } from "../../services/basculas/basculas.service";
import { AgenteBasculaService, EstadoBascula } from "../../services/agente-bascula/agente-bascula.service";
import { SocketService } from "../../services/socket/socket.service";
import { PisoBrandComponent } from "./piso-brand.component";
import { atajoBloqueado, avancePedido, confirmarDesbalance, confirmarRepesar, documentoCerrado, formatearTemperatura, leerMuellePiso, lineaOmitida, mensajeApi, mensajePesoInvalido, nombreMuelle, pedidoEnDe } from "./piso-ui";

@Component({
  selector: "app-portal-pesar",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PisoBrandComponent],
  templateUrl: "./portal-pesar.component.html",
  styleUrl: "./piso-portal.css",
})
export class PortalPesarComponent implements OnInit, OnDestroy {
  nombreMuelle = nombreMuelle;
  cargueId = "";
  docId = "";
  lineaId = "";
  doc: any = null;
  linea: any = null;
  error = "";
  guardando = false;

  unidadesCap: number | null = null;
  lote = "";
  temperatura = "";
  fechaVencimiento = "";

  taras: { nombre: string; peso: number; cuenta: number }[] = [];
  editarTara = false;
  @ViewChildren("taraInput") taraInputs?: QueryList<ElementRef<HTMLInputElement>>;

  bascula: { _id?: string; nombre?: string; ip?: string; puerto?: number; muelle?: { nombre?: string } | string } | null = null;
  conectado = false;
  conectando = false;
  errorBascula = "";
  pesoVivoNum: number | null = null;
  pesoManual: number | null = null;
  private socketSubs: Subscription[] = [];
  private reintento?: ReturnType<typeof setTimeout>;
  private cerrado = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private piso: PisoService,
    private tarasApi: TarasEmpaquesService,
    private basculas: BasculasService,
    private agente: AgenteBasculaService,
    private socket: SocketService
  ) {}

  ngOnInit(): void {
    this.cargueId = this.route.snapshot.paramMap.get("cargueId") || "";
    this.docId = this.route.snapshot.paramMap.get("docId") || "";
    this.lineaId = this.route.snapshot.paramMap.get("lineaId") || "";
    this.cargar();
    this.cargarTaras();
    this.cargarCatalogoBascula();
    if (environment.production) this.conectarAgente();
    else this.conectarBascula();
  }

  ngOnDestroy(): void {
    this.cerrado = true;
    if (this.reintento) clearTimeout(this.reintento);
    this.socketSubs.forEach((s) => s.unsubscribe());
    if (!environment.production && this.bascula?._id) {
      this.socket.emitSocket("bascula-unsubscribe", { id: this.bascula._id });
    }
  }

  get pesoVivo(): number | null {
    if (this.pesoManual != null) return this.pesoManual;
    return this.pesoVivoNum;
  }

  get pesoMostrado(): string {
    const v = this.pesoVivo;
    const n = v == null ? 0 : v;
    return n.toFixed(1).padStart(6, "0");
  }

  get taraTotal(): number {
    return this.taras.reduce((acc, t) => acc + t.cuenta * t.peso, 0);
  }

  get taraDetalle(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const t of this.taras) {
      if (t.cuenta) out[t.nombre] = t.cuenta;
    }
    return out;
  }

  get pedidoEn() {
    return pedidoEnDe(this.linea);
  }

  get faltanteUnd(): number {
    return Math.max(0, Number(this.linea?.unidades || 0) - Number(this.linea?.cd || 0));
  }

  get faltanteKg(): number {
    return Math.max(0, Number(this.linea?.pesoPedido || 0) - Number(this.linea?.pd || 0));
  }

  get excesoUnd(): number {
    return Math.max(0, Number(this.linea?.cd || 0) - Number(this.linea?.unidades || 0));
  }

  get excesoKg(): number {
    return Math.max(0, Number(this.linea?.pd || 0) - Number(this.linea?.pesoPedido || 0));
  }

  get avance() {
    return avancePedido(this.linea);
  }

  get docCerrado() {
    return documentoCerrado(this.doc);
  }

  get puedeRepesar() {
    if (!this.linea) return false;
    return (
      this.docCerrado ||
      lineaOmitida(this.linea) ||
      String(this.linea.estadoDespacho || "").toUpperCase() === "DESP" ||
      (this.linea.pesajes || []).length > 0
    );
  }

  onLoteChange() {
    this.recalcularVencimiento();
  }

  normalizarTemperatura() {
    const fmt = formatearTemperatura(this.temperatura);
    this.temperatura = fmt || String(this.temperatura || "").trim();
  }

  private recalcularVencimiento() {
    const fechaLote = this.parsearFechaLote(this.lote);
    const meses = Number(this.linea?.vidaUtilMeses) || 0;
    const dias = Number(this.linea?.vidaUtilDias) || 0;
    if (!fechaLote || (!meses && !dias)) {
      if (!fechaLote) this.fechaVencimiento = "";
      return;
    }
    const [y, m, d] = fechaLote.split("-").map((n) => Number(n));
    const dt = new Date(y, m - 1, d);
    if (meses) dt.setMonth(dt.getMonth() + meses);
    if (dias) dt.setDate(dt.getDate() + dias);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    this.fechaVencimiento = `${yy}-${mm}-${dd}`;
  }

  private parsearFechaLote(lote: string): string {
    const s = String(lote || "").trim();
    if (!s || s === "0") return "";
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const dmy = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    const compact8 = s.match(/^(\d{8})$/);
    if (compact8) {
      const n = compact8[1];
      if (n.startsWith("20") || n.startsWith("19")) {
        return `${n.slice(0, 4)}-${n.slice(4, 6)}-${n.slice(6, 8)}`;
      }
      return `${n.slice(4, 8)}-${n.slice(2, 4)}-${n.slice(0, 2)}`;
    }
    return "";
  }

  cargar() {
    this.piso.getCargue(this.cargueId).subscribe({
      next: (res) => {
        const docs = res?.body?.documentos || [];
        this.doc = docs.find((d: any) => String(d._id) === this.docId) || null;
        this.linea = (this.doc?.lineas || []).find((l: any) => String(l.idLinea) === this.lineaId) || null;
        if (!this.linea) this.error = "No se encontró el producto.";
        else {
          this.recalcularVencimiento();
          this.aplicarDefaultsEmpaque();
        }
      },
      error: (err) => {
        this.error = mensajeApi(err, "No se pudo leer el producto.");
      },
    });
  }

  cargarTaras() {
    this.tarasApi.Get().subscribe({
      next: (res) => {
        const lista = (res?.body || []).filter((t: any) => t.activo !== false);
        this.taras = lista.map((t: any) => ({
          nombre: t.nombre,
          peso: Number(t.peso) || 0,
          cuenta: 0,
        }));
        this.aplicarDefaultsEmpaque();
      },
      error: () => {
        this.taras = [];
      },
    });
  }

  private cargarCatalogoBascula() {
    this.basculas.GetPiso(leerMuellePiso()).subscribe({
      next: (res) => {
        this.bascula = res?.body || this.bascula;
      },
      error: () => {
        /* el peso lo da el agente en producción */
      },
    });
  }

  private aplicarPesoAgente(estado: EstadoBascula | null | undefined) {
    if (!estado) return;
    if (estado.conectado === false) {
      this.conectado = false;
      if (estado.error) this.errorBascula = String(estado.error);
    }
    if (typeof estado.peso === "number" && Number.isFinite(estado.peso)) {
      this.pesoVivoNum = estado.peso;
      this.pesoManual = null;
      this.conectado = true;
      this.errorBascula = "";
    } else if (estado.conectado) {
      this.conectado = true;
      this.errorBascula = "";
    }
  }

  private conectarAgente() {
    this.conectando = true;
    this.errorBascula = "";
    this.agente.estado().subscribe({
      next: (res) => {
        this.conectando = false;
        this.aplicarPesoAgente(res?.body);
        this.socketSubs.push(
          this.agente.eventos().subscribe({
            next: (ev) => this.aplicarPesoAgente(ev),
            error: () => {
              this.conectado = false;
              this.errorBascula = "Se perdió el agente local (puerto 3920).";
              if (!this.cerrado) this.reintento = setTimeout(() => this.conectarAgente(), 3000);
            },
          })
        );
      },
      error: () => {
        this.conectando = false;
        this.conectado = false;
        this.errorBascula = "En este PC debe estar corriendo el agente-bascula (puerto 3920).";
        if (!this.cerrado) this.reintento = setTimeout(() => this.conectarAgente(), 3000);
      },
    });
  }

  private conectarBascula() {
    this.conectando = true;
    this.errorBascula = "";
    this.basculas.GetPiso(leerMuellePiso()).subscribe({
      next: (res) => {
        this.bascula = res?.body || null;
        if (!this.bascula?._id) {
          this.conectando = false;
          this.errorBascula = "No hay una báscula configurada.";
          return;
        }
        this.socket.emitSocket("bascula-subscribe", { id: this.bascula._id });
        this.socketSubs.push(
          this.socket.eventBasculaDato().subscribe((msg: any) => {
            if (String(msg?.id) !== String(this.bascula?._id)) return;
            const peso = Number(msg?.peso);
            if (Number.isFinite(peso)) {
              this.pesoVivoNum = peso;
              this.pesoManual = null;
              this.conectado = true;
              this.errorBascula = "";
            }
          })
        );
        this.socketSubs.push(
          this.socket.eventBasculaEstado().subscribe((msg: any) => {
            if (String(msg?.id) !== String(this.bascula?._id)) return;
            this.conectado = !!msg?.conectado;
            if (msg?.error) this.errorBascula = String(msg.error);
            if (msg?.conectado) this.errorBascula = "";
          })
        );
        this.abrirTcp();
      },
      error: (err) => {
        this.conectando = false;
        this.errorBascula = mensajeApi(err, "No hay una báscula configurada.");
        if (this.cerrado) return;
        this.reintento = setTimeout(() => this.conectarBascula(), 3000);
      },
    });
  }

  private abrirTcp() {
    if (!this.bascula?._id || this.cerrado) return;
    this.conectando = true;
    this.basculas.Escuchar(this.bascula._id).subscribe({
      next: () => {
        this.conectando = false;
        this.conectado = true;
        this.errorBascula = "";
      },
      error: (err) => {
        this.conectando = false;
        this.conectado = false;
        this.errorBascula = mensajeApi(err, "No se pudo conectar con la báscula.");
        if (this.cerrado) return;
        this.reintento = setTimeout(() => this.abrirTcp(), 3000);
      },
    });
  }

  volver() {
    this.router.navigate(["/portal-despachador", this.cargueId, this.docId]);
  }

  habilitarTara() {
    this.editarTara = true;
    setTimeout(() => {
      const lista = this.taraInputs?.toArray() || [];
      const idx = this.taras.findIndex((t) => this.esTaraItem(t));
      const input = lista[idx >= 0 ? idx : 0];
      input?.nativeElement?.focus();
      input?.nativeElement?.select();
    }, 0);
  }

  aceptarTara() {
    for (const t of this.taras) {
      const n = Number(t.cuenta);
      t.cuenta = Number.isFinite(n) && n > 0 ? n : 0;
    }
    this.aplicarUnidadesDesdeTara();
    this.editarTara = false;
  }

  onTaraCuenta() {
    this.aplicarUnidadesDesdeTara();
  }

  esTaraItem(t: { nombre: string }): boolean {
    const item = this.aliasTara(this.linea?.taraNombre);
    if (!item) return false;
    return this.aliasTara(t.nombre) === item || this.clave(t.nombre) === this.clave(this.linea?.taraNombre);
  }

  private clave(valor: any): string {
    return String(valor || "").trim().toUpperCase();
  }

  private aliasTara(nombre: any): string {
    const n = this.clave(nombre);
    if (n === "DOBLE CANASTILLA") return "CANASTILLA";
    return n;
  }

  private aplicarDefaultsEmpaque() {
    const und = Number(this.linea?.unidadesEmpaque) || 0;
    if (und > 0 && this.unidadesCap == null) this.unidadesCap = und;
    this.aplicarUnidadesDesdeTara();
  }

  private aplicarUnidadesDesdeTara() {
    const und = Number(this.linea?.unidadesEmpaque) || 0;
    if (!(und > 0)) return;
    const cuenta = this.cuentaTaraItem();
    if (cuenta > 0) this.unidadesCap = cuenta * und;
  }

  private cuentaTaraItem(): number {
    const nombreItem = this.aliasTara(this.linea?.taraNombre);
    const taras = nombreItem
      ? this.taras.filter((t) => this.esTaraItem(t))
      : this.taras;
    return taras.reduce((acc, t) => acc + (Number(t.cuenta) || 0), 0);
  }

  resetTaras() {
    this.taras.forEach((t) => (t.cuenta = 0));
    this.editarTara = false;
    const und = Number(this.linea?.unidadesEmpaque) || 0;
    this.unidadesCap = und > 0 ? und : this.unidadesCap;
  }

  async pedirUnidades() {
    const r = await Swal.fire({
      title: "Unidades",
      input: "number",
      inputValue: this.unidadesCap ?? "",
      showCancelButton: true,
      confirmButtonText: "Aceptar",
    });
    if (!r.isConfirmed) return;
    const n = Number(r.value);
    if (Number.isFinite(n) && n > 0) this.unidadesCap = n;
  }

  async pedirLote() {
    const r = await Swal.fire({
      title: "Fecha del lote",
      input: "date",
      inputValue: this.parsearFechaLote(this.lote) || this.lote,
      showCancelButton: true,
      confirmButtonText: "Aceptar",
    });
    if (!r.isConfirmed) return;
    this.lote = String(r.value ?? "");
    this.recalcularVencimiento();
  }

  async pedirTemperatura() {
    const r = await Swal.fire({
      title: "Temperatura",
      input: "text",
      inputValue: this.temperatura,
      inputPlaceholder: "Ej. 4.0",
      inputValidator: (value) => {
        if (!formatearTemperatura(value)) return "Debe llevar un decimal (ej. 4.0).";
        return null;
      },
      showCancelButton: true,
      confirmButtonText: "Aceptar",
    });
    if (r.isConfirmed) this.temperatura = formatearTemperatura(r.value) || "";
  }

  async pedirPesoManual() {
    const r = await Swal.fire({
      title: "Peso (kg)",
      input: "number",
      inputValue: this.pesoVivo != null && this.pesoVivo >= 0 ? this.pesoVivo : "",
      inputAttributes: { min: "0", step: "0.1" },
      inputValidator: (value) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return "Indique el peso.";
        if (n < 0) return "El peso no puede ser negativo.";
        if (!(n > 1)) return "El peso debe ser mayor a 1 kg.";
        return null;
      },
      showCancelButton: true,
      confirmButtonText: "Aceptar",
    });
    if (!r.isConfirmed) return;
    const n = Number(r.value);
    if (!Number.isFinite(n) || n < 0) {
      Swal.fire({ icon: "warning", title: "El peso no puede ser negativo." });
      return;
    }
    if (n > 1) this.pesoManual = n;
  }

  private faltantesRegistro(peso: number | null): string[] {
    const faltan: string[] = [];
    const loteOk = !!String(this.lote || "").trim() && this.lote !== "0";
    if (!loteOk) faltan.push("lote");
    if (!(this.taraTotal > 0)) faltan.push("tara");
    if (!(Number(this.unidadesCap) > 0)) faltan.push("unidades");
    if (!formatearTemperatura(this.temperatura)) faltan.push("temperatura con un decimal (ej. 4.0)");
    if (peso == null || !(peso > 1)) faltan.push("peso mayor a 1 kg");
    return faltan;
  }

  async registrar() {
    if (this.guardando || !this.linea) return;
    if (this.docCerrado || this.linea.omitido) {
      Swal.fire({
        icon: "info",
        title: this.linea.omitido ? "Producto omitido" : "Documento finalizado",
        text: "Use Repesar para volver a pesarlo.",
      });
      return;
    }
    const loteOk = !!String(this.lote || "").trim() && this.lote !== "0";
    const faltanDatos: string[] = [];
    if (!loteOk) faltanDatos.push("lote");
    if (!(this.taraTotal > 0)) faltanDatos.push("tara");
    if (!(Number(this.unidadesCap) > 0)) faltanDatos.push("unidades");
    if (!formatearTemperatura(this.temperatura)) faltanDatos.push("temperatura con un decimal (ej. 4.0)");
    if (faltanDatos.length) {
      Swal.fire({
        icon: "warning",
        title: "No se puede registrar el peso",
        text: `Falta: ${faltanDatos.join(", ")}.`,
      });
      return;
    }
    if (Number(this.unidadesCap) < 0) {
      Swal.fire({ icon: "warning", title: "Las unidades no pueden ser negativas." });
      return;
    }
    let peso = this.pesoVivo;
    if (peso != null && peso < 0) {
      Swal.fire({ icon: "warning", title: "El peso no puede ser negativo." });
      return;
    }
    if (peso == null || !(peso > 1)) {
      await this.pedirPesoManual();
      peso = this.pesoVivo;
    }
    const invalid = mensajePesoInvalido(peso, this.taraTotal);
    if (invalid) {
      Swal.fire({ icon: "warning", title: "No se puede registrar el peso", text: invalid });
      return;
    }
    const faltan = this.faltantesRegistro(peso);
    if (faltan.length) {
      Swal.fire({
        icon: "warning",
        title: "No se puede registrar el peso",
        text: `Falta: ${faltan.join(", ")}.`,
      });
      return;
    }
    this.guardando = true;
    this.piso
      .registrarPesaje({
        cargueId: this.cargueId,
        docId: this.docId,
        lineaId: this.lineaId,
        unidades: Number(this.unidadesCap),
        peso: peso as number,
        tara: Number(this.taraTotal.toFixed(3)),
        taraDetalle: this.taraDetalle,
        lote: this.lote,
        temperatura: formatearTemperatura(this.temperatura) || "",
        fechaVencimiento: this.fechaVencimiento,
      })
      .subscribe({
        next: (res) => {
          this.guardando = false;
          this.linea = res?.body?.linea || this.linea;
          this.doc = res?.body?.documento || this.doc;
          this.resetTaras();
          this.pesoManual = null;
        },
        error: (err) => {
          this.guardando = false;
          Swal.fire({ icon: "error", title: mensajeApi(err, "No se pudo registrar el peso.") });
        },
      });
  }

  quitar(p: any) {
    if (this.docCerrado || this.linea?.omitido) {
      Swal.fire({
        icon: "info",
        title: this.linea?.omitido ? "Producto omitido" : "Documento finalizado",
        text: "Use Repesar para volver a pesarlo.",
      });
      return;
    }
    this.piso
      .quitarPesaje({
        cargueId: this.cargueId,
        docId: this.docId,
        lineaId: this.lineaId,
        idPesaje: p.idPesaje,
      })
      .subscribe({
        next: (res) => {
          this.linea = res?.body?.linea || this.linea;
        },
        error: (err) =>
          Swal.fire({ icon: "error", title: mensajeApi(err, "No se pudo quitar el pesaje.") }),
      });
  }

  async repesar() {
    if (!this.puedeRepesar) return;
    const ok = await confirmarRepesar(
      lineaOmitida(this.linea)
        ? "El producto omitido volverá a pendiente para poder pesarlo."
        : "Se quitarán los pesajes de este producto para volver a pesarlo."
    );
    if (!ok) return;
    this.piso.repesar({ cargueId: this.cargueId, docId: this.docId, lineaId: this.lineaId }).subscribe({
      next: (res) => {
        this.doc = res?.body || this.doc;
        this.linea = (this.doc?.lineas || []).find((l: any) => String(l.idLinea) === this.lineaId) || this.linea;
        this.resetTaras();
        this.pesoManual = null;
      },
      error: (err) =>
        Swal.fire({ icon: "error", title: mensajeApi(err, "No se pudo volver a pesar.") }),
    });
  }

  async guardar() {
    if (!(await this.confirmarSiDesbalance("guardar"))) return;
    this.volver();
  }

  private tienePesaje() {
    return (
      (this.linea?.pesajes || []).length > 0 ||
      Number(this.linea?.cd) > 0 ||
      Number(this.linea?.pd) > 0
    );
  }

  private async confirmarSiDesbalance(accion: string) {
    const av = this.avance;
    if (av.estado !== "falta" && av.estado !== "exceso") return true;
    if (av.estado === "falta" && !this.tienePesaje()) return true;
    const um = this.pedidoEn === "KILOS" ? "kg" : "unidades";
    const detalle =
      av.estado === "exceso"
        ? `Hay exceso en ${um} (${av.etiqueta}, ${av.pct.toFixed(0)}%). ¿Confirma ${accion} igual?`
        : `Falta despacho en ${um} (${av.etiqueta}, ${av.pct.toFixed(0)}%). ¿Confirma ${accion} igual?`;
    return confirmarDesbalance({
      estado: av.estado,
      etiqueta: av.etiqueta,
      detalle,
      accion: accion === "guardar" ? "Guardar" : "Salir",
    });
  }

  @HostListener("window:keydown", ["$event"])
  onKey(ev: KeyboardEvent) {
    if (atajoBloqueado(ev)) return;
    const k = ev.key;
    if (k === "F10") {
      ev.preventDefault();
      this.volver();
      return;
    }
    if (k === "F8") {
      ev.preventDefault();
      this.pedirTemperatura();
      return;
    }
    if (k === "+" || k === "=") {
      ev.preventDefault();
      this.registrar();
      return;
    }
    if (k === "r" || k === "R") {
      ev.preventDefault();
      void this.repesar();
      return;
    }
    if (k === "g" || k === "G") {
      ev.preventDefault();
      void this.guardar();
      return;
    }
    if (k === "u" || k === "U") {
      ev.preventDefault();
      this.pedirUnidades();
      return;
    }
    if (k === "t" || k === "T") {
      ev.preventDefault();
      this.habilitarTara();
      return;
    }
    if (k === "l" || k === "L") {
      ev.preventDefault();
      this.pedirLote();
    }
  }
}
