import { Component, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { ConductorService } from "../../services/despacho/conductor.service";
import { FirmaPadComponent } from "./firma-pad.component";
import Swal from "sweetalert2";

type RecaudoFila = {
  tipo: string;
  monto: number | null;
  fecha: string;
  referencia: string;
  recibo: string;
  aprobacion: string;
  convenio: string;
  terminal: string;
  codigoUnico: string;
  lugar: string;
  pagador: string;
  nitPagador: string;
  beneficiario: string;
  nitBeneficiario: string;
  cuentaOrigen: string;
  cuentaDestino: string;
  costo: number | null;
  banco: string;
  formaPago: string;
  oficina: string;
  usuarioBanco: string;
  tipoId: string;
  numeroId: string;
  codigoConvenio: string;
  referencia2: string;
  placaTicket: string;
  caja: string;
  rrn: string;
  foto: string;
  extra: boolean;
  leyendo: boolean;
  errorOcr: string;
  tipoEtiqueta: string;
};

type LineaNovedad = {
  referencia: string;
  concepto: string;
  um: string;
  cantidadFactura: number;
  kilos: number;
  unidades: number;
  valorBruto: number;
  unidadesDevolucion: number;
  kilosDevolucion: number;
  mermaPct: number;
  kilosMerma: number;
  unidadesFaltante: number;
  kilosFaltante: number;
  valorNovedad: number;
  motivo: string;
  observacion: string;
};

@Component({
  selector: "app-portal-conductor-factura",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, FirmaPadComponent],
  templateUrl: "./portal-conductor-factura.component.html",
  styleUrl: "./portal-conductor.css",
})
export class PortalConductorFacturaComponent implements OnInit {
  cargando = true;
  guardando = false;
  error = "";
  hojaId = "";
  docId = "";
  data: any = null;
  entregaCompleta = true;
  motivo = "ENTREGADO";
  observacion = "";
  tipoPago: "CREDITO" | "CONTADO" = "CONTADO";
  notaCredito = "";
  auxiliar = "";
  lineas: LineaNovedad[] = [];
  firmaCliente = "";
  firmaTransporte = "";
  firmaEmpresa = "";
  recaudos: RecaudoFila[] = [];
  tiposRecaudo: { codigo: string; nombre: string; banco?: string }[] = [
    { codigo: "CORRESPONSAL", nombre: "Corresponsal / Wompi", banco: "Bancolombia" },
    { codigo: "PAGO_PROVEEDORES", nombre: "Pago a proveedores", banco: "Bancolombia" },
    { codigo: "TRANSFERENCIA", nombre: "Transferencia app", banco: "Bancolombia" },
    { codigo: "NEQUI", nombre: "Nequi", banco: "Nequi" },
    { codigo: "RECAUDO_EMPRESARIAL", nombre: "Recaudo empresarial (Davivienda)", banco: "Davivienda" },
    { codigo: "OTRO", nombre: "Otro comprobante", banco: "" },
  ];

  @ViewChild("padCliente") padCliente?: FirmaPadComponent;
  @ViewChild("padTransporte") padTransporte?: FirmaPadComponent;
  @ViewChild("padEmpresa") padEmpresa?: FirmaPadComponent;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ConductorService
  ) {}

  ngOnInit() {
    this.hojaId = this.route.snapshot.paramMap.get("hojaId") || "";
    this.docId = this.route.snapshot.paramMap.get("docId") || "";
    this.api.getFactura(this.hojaId, this.docId).subscribe({
      next: (res) => {
        this.data = res?.body || {};
        const entrega = this.data.entrega || {};
        this.motivo = entrega.motivo || "ENTREGADO";
        this.entregaCompleta = this.motivo === "ENTREGADO" || !entrega.motivo;
        this.observacion = entrega.observacion || "";
        this.tipoPago = entrega.tipoPago === "CREDITO" ? "CREDITO" : "CONTADO";
        this.notaCredito = entrega.notaCredito || "";
        this.auxiliar = entrega.auxiliar || this.data.hoja?.auxiliar || this.data.hoja?.conductor || "";
        this.firmaCliente = entrega.firmaCliente || "";
        this.firmaTransporte = entrega.firmaTransporte || "";
        this.firmaEmpresa = entrega.firmaEmpresa || "";
        this.lineas = (entrega.lineas || this.data.lineas || []).map((l: any) => this.lineaDe(l));
        this.tiposRecaudo = this.data.tiposRecaudo?.length ? this.data.tiposRecaudo : this.tiposRecaudo;
        this.recaudos = (this.data.stop?.recaudos || []).map((r: any) => this.recaudoDe(r));
        this.cargando = false;
      },
      error: (err) => {
        this.error = err?.error?.body?.message || "No se pudo leer la factura.";
        this.cargando = false;
      },
    });
  }

  get nroNovedad() {
    const n = Number(this.data?.entrega?.nroNovedad) || 0;
    return n ? String(n).padStart(6, "0") : "Se asigna al guardar";
  }

  get gruposMotivo() {
    const motivos = (this.data?.motivos || []).filter((m: any) => m.codigo !== "ENTREGADO");
    const grupos = [
      { id: "comercial", nombre: "Comercial" },
      { id: "logistica", nombre: "Logística" },
      { id: "calidad", nombre: "Calidad" },
      { id: "categoria", nombre: "Categoría" },
    ];
    return grupos
      .map((g) => ({ ...g, items: motivos.filter((m: any) => m.grupo === g.id) }))
      .filter((g) => g.items.length);
  }

  get totalNovedad() {
    return this.lineas.reduce((acc, l) => acc + (Number(l.valorNovedad) || 0), 0);
  }

  get valorFactura() {
    return Number(this.data?.stop?.valor || this.data?.factura?.valor) || 0;
  }

  get evaluacion() {
    const factura = Math.round(this.valorFactura);
    const novedad = Math.round(this.totalNovedad);
    const credito = this.tipoPago === "CREDITO";
    const totalRecaudado = Math.round(
      this.recaudos.reduce((acc, r) => acc + (Number(r.monto) || 0), 0)
    );
    const esperado = Math.max(0, factura - novedad);
    const diferencia = esperado - totalRecaudado;
    let estado = "sin_recaudo";
    if (credito && totalRecaudado <= 0) estado = "no_aplica";
    else if (esperado <= 0 && totalRecaudado <= 0) estado = "no_aplica";
    else if (Math.abs(diferencia) <= 1) estado = "cuadrado";
    else if (diferencia > 1) estado = "falta";
    else estado = "exceso";
    return { factura, novedad, esperado, totalRecaudado, diferencia, estado, credito };
  }

  pesos(valor: number | null | undefined) {
    return `$ ${(Number(valor) || 0).toLocaleString("es-CO")}`;
  }

  etiquetaTipo(codigo: string) {
    return this.tiposRecaudo.find((t) => t.codigo === codigo)?.nombre || codigo || "Comprobante";
  }

  etiquetaRecaudo(estado: string) {
    const ev = this.evaluacion;
    if (estado === "cuadrado") return "El recaudo cuadra con la factura.";
    if (estado === "falta") return `Faltan ${this.pesos(ev.diferencia)} según los comprobantes.`;
    if (estado === "exceso") return `Los comprobantes superan la factura en ${this.pesos(Math.abs(ev.diferencia))}.`;
    if (estado === "no_aplica") return ev.credito ? "Crédito: el recaudo no es obligatorio." : "No hay valor a recaudar.";
    return "Sin recaudo. Tome la foto del comprobante.";
  }

  quitarRecaudo(i: number) {
    this.recaudos = this.recaudos.filter((_, idx) => idx !== i);
  }

  async onFotoNueva(ev: Event) {
    const rec = this.recaudoDe({});
    this.recaudos = [...this.recaudos, rec];
    await this.onFoto(ev, rec);
    if (!rec.foto && !rec.leyendo) this.quitarRecaudo(this.recaudos.length - 1);
  }

  async onFoto(ev: Event, recaudo: RecaudoFila) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      recaudo.errorOcr = "";
      recaudo.foto = await this.comprimirFoto(file);
      recaudo.leyendo = true;
      this.api.leerComprobante(recaudo.foto).subscribe({
        next: (res) => {
          recaudo.leyendo = false;
          this.aplicarLectura(recaudo, res?.body || {});
        },
        error: (err) => {
          recaudo.leyendo = false;
          recaudo.errorOcr =
            err?.error?.body?.message || "No se leyó el ticket. Revise el monto a mano si hace falta.";
        },
      });
    } catch {
      recaudo.leyendo = false;
      Swal.fire({ icon: "error", title: "No se pudo leer la foto", text: "Intente de nuevo con otra toma." });
    }
  }

  private aplicarLectura(rec: RecaudoFila, body: any) {
    const tipo = String(body.tipo || rec.tipo || "OTRO").toUpperCase();
    rec.tipo = tipo;
    rec.tipoEtiqueta = body.tipoEtiqueta || this.etiquetaTipo(tipo);
    if (body.banco) rec.banco = body.banco;
    if (Number(body.monto) > 0) rec.monto = Number(body.monto);
    if (body.fecha) rec.fecha = String(body.fecha).slice(0, 16);
    const copiar = [
      "referencia",
      "recibo",
      "aprobacion",
      "convenio",
      "terminal",
      "codigoUnico",
      "lugar",
      "pagador",
      "nitPagador",
      "beneficiario",
      "nitBeneficiario",
      "cuentaOrigen",
      "cuentaDestino",
      "formaPago",
      "oficina",
      "usuarioBanco",
      "tipoId",
      "numeroId",
      "codigoConvenio",
      "referencia2",
      "placaTicket",
      "caja",
      "rrn",
    ] as const;
    for (const k of copiar) {
      if (body[k]) rec[k] = String(body[k]);
    }
    if (body.costo != null) rec.costo = Number(body.costo) || 0;
    if (!rec.monto) {
      rec.errorOcr = "Se detectó el comprobante pero no el valor. Digite el monto del ticket.";
    }
  }

  private recaudoDe(r: any = {}): RecaudoFila {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    const tipo = r.tipo || "";
    return {
      tipo,
      tipoEtiqueta: r.tipoEtiqueta || this.etiquetaTipo(tipo),
      monto: r.monto == null || r.monto === "" ? null : Number(r.monto),
      fecha: String(r.fecha || "").slice(0, 16) || local,
      referencia: r.referencia || "",
      recibo: r.recibo || "",
      aprobacion: r.aprobacion || "",
      convenio: r.convenio || "",
      terminal: r.terminal || "",
      codigoUnico: r.codigoUnico || "",
      lugar: r.lugar || "",
      pagador: r.pagador || "",
      nitPagador: r.nitPagador || "",
      beneficiario: r.beneficiario || "",
      nitBeneficiario: r.nitBeneficiario || "",
      cuentaOrigen: r.cuentaOrigen || "",
      cuentaDestino: r.cuentaDestino || "",
      costo: r.costo == null ? 0 : Number(r.costo),
      banco: r.banco || "",
      formaPago: r.formaPago || "",
      oficina: r.oficina || "",
      usuarioBanco: r.usuarioBanco || "",
      tipoId: r.tipoId || "",
      numeroId: r.numeroId || "",
      codigoConvenio: r.codigoConvenio || "",
      referencia2: r.referencia2 || "",
      placaTicket: r.placaTicket || "",
      caja: r.caja || "",
      rrn: r.rrn || "",
      foto: r.foto || "",
      extra: false,
      leyendo: false,
      errorOcr: "",
    };
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

  marcarCompleta() {
    this.entregaCompleta = true;
    this.motivo = "ENTREGADO";
  }

  marcarNovedad() {
    this.entregaCompleta = false;
    if (this.motivo === "ENTREGADO") this.motivo = "MERMA";
  }

  volver() {
    this.router.navigate(["/portal-conductor"]);
  }

  cambiarMermaPct(linea: LineaNovedad) {
    const kilos = Number(linea.kilos) || 0;
    const pct = Math.max(0, Number(linea.mermaPct) || 0);
    linea.mermaPct = pct;
    if (kilos) linea.kilosMerma = Math.round(kilos * pct) / 100;
    this.recalcularValor(linea);
  }

  cambiarMermaKg(linea: LineaNovedad) {
    const kilos = Number(linea.kilos) || 0;
    const merma = Math.max(0, Number(linea.kilosMerma) || 0);
    linea.kilosMerma = merma;
    linea.mermaPct = kilos ? Math.round((merma / kilos) * 10000) / 100 : 0;
    this.recalcularValor(linea);
  }

  recalcularValor(linea: LineaNovedad) {
    const kilosNov =
      (Number(linea.kilosDevolucion) || 0) +
      (Number(linea.kilosMerma) || 0) +
      (Number(linea.kilosFaltante) || 0);
    const undNov = (Number(linea.unidadesDevolucion) || 0) + (Number(linea.unidadesFaltante) || 0);
    const denom = Number(linea.kilos) || Number(linea.unidades) || Number(linea.cantidadFactura) || 0;
    const qty = kilosNov || undNov;
    if (!qty || !linea.valorBruto || !denom) return;
    linea.valorNovedad = Math.round((Number(linea.valorBruto) / denom) * qty);
  }

  guardar() {
    if (this.guardando) return;
    const motivo = this.entregaCompleta ? "ENTREGADO" : this.motivo;
    if (!this.entregaCompleta && (!motivo || motivo === "ENTREGADO")) {
      Swal.fire({ icon: "warning", title: "Elija el motivo", text: "Marque el código del documento de novedades." });
      return;
    }
    const ev = this.evaluacion;
    if (!ev.credito && ev.esperado > 0 && !this.recaudos.some((r) => Number(r.monto) > 0)) {
      Swal.fire({
        icon: "warning",
        title: "Falta el recaudo",
        text: "En contado tome la foto del comprobante. El valor se lee del ticket y se compara con la factura.",
      });
      return;
    }
    this.guardando = true;
    this.api
      .guardarEntrega(this.hojaId, this.docId, {
        motivo,
        observacion: this.observacion,
        tipoPago: this.tipoPago,
        notaCredito: this.notaCredito,
        auxiliar: this.auxiliar,
        lineas: this.lineas,
        recaudos: this.recaudos.filter((r) => Number(r.monto) > 0 || r.foto),
        firmaCliente: this.padCliente?.capturar() || this.firmaCliente,
        firmaTransporte: this.padTransporte?.capturar() || this.firmaTransporte,
        firmaEmpresa: this.padEmpresa?.capturar() || this.firmaEmpresa,
      })
      .subscribe({
        next: () => {
          this.guardando = false;
          Swal.fire({
            toast: true,
            position: "top",
            icon: "success",
            title: this.entregaCompleta ? "Entrega registrada." : "Novedad guardada.",
            text: this.etiquetaRecaudo(this.evaluacion.estado),
            showConfirmButton: false,
            timer: 2500,
          });
          this.volver();
        },
        error: (err) => {
          this.guardando = false;
          Swal.fire({
            icon: "error",
            title: "No se pudo guardar",
            text: err?.error?.body?.message || "No se pudo guardar la novedad.",
          });
        },
      });
  }

  private lineaDe(l: any): LineaNovedad {
    return {
      referencia: l.referencia || "",
      concepto: l.concepto || "",
      um: l.um || "",
      cantidadFactura: Number(l.cantidadFactura || l.cantidad || l.unidades || l.kilos) || 0,
      kilos: Number(l.kilos) || 0,
      unidades: Number(l.unidades) || 0,
      valorBruto: Number(l.valorBruto) || 0,
      unidadesDevolucion: Number(l.unidadesDevolucion) || 0,
      kilosDevolucion: Number(l.kilosDevolucion) || 0,
      mermaPct: Number(l.mermaPct) || 0,
      kilosMerma: Number(l.kilosMerma) || 0,
      unidadesFaltante: Number(l.unidadesFaltante) || 0,
      kilosFaltante: Number(l.kilosFaltante) || 0,
      valorNovedad: Number(l.valorNovedad) || 0,
      motivo: l.motivo || "",
      observacion: l.observacion || "",
    };
  }
}
