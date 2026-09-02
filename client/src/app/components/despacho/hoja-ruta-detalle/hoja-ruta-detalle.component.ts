import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { Subscription, timeout } from "rxjs";
import { MaterialModule } from "../../../material.module";
import { HojasRutaService } from "../../../services/despacho/hojas-ruta.service";
import { FirmantesService } from "../../../services/despacho/firmantes.service";
import { imprimirCertificados as abrirCertificados, imprimirRutero as abrirRutero, abrirVentanaImpresion } from "../../../services/despacho/hoja-impresion";
import { etiquetaPedido } from "../../../core/etiqueta-docto";
import Swal from "sweetalert2";

@Component({
  selector: "app-hoja-ruta-detalle",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MaterialModule],
  templateUrl: "./hoja-ruta-detalle.component.html",
  styleUrls: [
    "../despacho-page.css",
    "../cargues/cargues.component.css",
    "../cargue-detalle/cargue-detalle.component.css",
    "./hoja-ruta-detalle.component.css",
  ],
})
export class HojaRutaDetalleComponent implements OnInit {
  hoja: any = null;
  vehiculos: any[] = [];
  firmantesCalidad: any[] = [];
  firmantesLogistica: any[] = [];
  cargando = true;
  modoAgregar: "" | "facturas" | "cargue" = "";
  factura = "";
  agregandoFactura = false;
  panelCargue = false;
  panelFacturas = false;
  panelVehiculo = false;
  panelDatos = false;
  cargandoDisponibles = false;
  cargandoFacturas = false;
  private facturasSub: Subscription | null = null;
  disponibles: any[] = [];
  catalogoFacturas: any[] = [];
  tiposFactura: string[] = [];
  bodegasFactura: string[] = [];
  vendedoresFactura: string[] = [];
  avisoFacturas = "";
  facturas: Record<string, string> = {};
  seleccionDisponibles = new Set<string>();
  seleccionFacturas = new Set<string>();
  seleccion = new Set<string>();
  placaNueva = "";
  etiquetaPedido = etiquetaPedido;
  editNombre = "";
  editFecha = "";
  editPeso: number | null = null;
  editTemperatura = "";
  editCanastas = "";
  editBultos = "";
  editAuxiliar = "";
  editObservaciones = "";
  editFirmanteCalidadId = "";
  editFirmanteLogisticaId = "";
  detalleOculto = false;
  detalleFacturasOculto = false;
  guardando = false;
  filtrosFacturas = {
    desde: "",
    hasta: "",
    nit: "",
    razon_social: "",
    contacto: "",
    barrio: "",
    municipio: "",
    num_factura: "",
    tipo_doc: "",
    bodega: "",
    vendedor: "",
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private hojas: HojasRutaService,
    private firmantesApi: FirmantesService
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get("id");
    if (!id) return;
    this.cargar(id);
    this.hojas.vehiculos().subscribe({
      next: (res) => (this.vehiculos = res.body || []),
      error: () => (this.vehiculos = []),
    });
    this.firmantesApi.listar().subscribe({
      next: (res) => {
        const lista = (res.body || []).filter((item: any) => item.tieneFirma || item.firma);
        this.firmantesCalidad = lista.filter((item: any) => item.cargo === "AUXILIAR_CALIDAD");
        this.firmantesLogistica = lista.filter((item: any) => item.cargo === "SUPERVISOR_LOGISTICA");
      },
      error: () => {
        this.firmantesCalidad = [];
        this.firmantesLogistica = [];
      },
    });
  }

  get documentos() {
    return this.hoja?.documentos || [];
  }

  get editable() {
    return this.hoja?.estado === "temporal";
  }

  get titulo() {
    return this.hoja?.estado === "temporal" ? "Nueva Hoja de Ruta" : "Hoja de Ruta";
  }

  cargar(id: string) {
    this.cargando = true;
    this.hojas.get(id).subscribe({
      next: (res) => {
        this.hoja = res.body;
        this.modoAgregar = "";
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        Swal.fire({ icon: "error", title: err?.error?.body?.message || "No se pudo leer la hoja" });
        this.router.navigate(["/configuracion/despacho/hojas-de-ruta"]);
      },
    });
  }

  mostrarAgregar(modo: "facturas" | "cargue") {
    if (!this.editable) return;
    this.modoAgregar = modo;
    if (modo === "cargue") this.abrirCargue();
    if (modo === "facturas") this.abrirFacturas();
  }

  get facturasFiltradas() {
    return this.catalogoFacturas.filter((item) => {
      const f = this.filtrosFacturas;
      if (f.nit && !String(item.nit || "").toLowerCase().includes(f.nit.toLowerCase())) return false;
      if (f.razon_social && !String(item.razonSocial || "").toLowerCase().includes(f.razon_social.toLowerCase())) {
        return false;
      }
      if (f.contacto && !String(item.contacto || "").toLowerCase().includes(f.contacto.toLowerCase())) return false;
      if (f.barrio && !String(item.barrio || "").toLowerCase().includes(f.barrio.toLowerCase())) return false;
      if (f.municipio && !String(item.municipio || "").toLowerCase().includes(f.municipio.toLowerCase())) return false;
      if (f.num_factura && !String(item.numFactura || "").toLowerCase().includes(f.num_factura.toLowerCase())) {
        return false;
      }
      if (f.tipo_doc && String(item.tipoDoc || item.tipoDocPedido || "") !== f.tipo_doc) return false;
      if (f.bodega && String(item.bodega || "") !== f.bodega) return false;
      if (f.vendedor && String(item.vendedor || "") !== f.vendedor) return false;
      return true;
    });
  }

  abrirFacturas() {
    if (!this.editable) return;
    const hoy = this.hoja?.fecha || new Date().toISOString().slice(0, 10);
    if (!this.filtrosFacturas.desde) this.filtrosFacturas.desde = hoy;
    if (!this.filtrosFacturas.hasta) this.filtrosFacturas.hasta = hoy;
    this.panelFacturas = true;
    this.cargarFacturas();
  }

  cargarFacturas(refrescar = false) {
    this.facturasSub?.unsubscribe();
    this.cargandoFacturas = true;
    this.avisoFacturas = "";
    this.facturasSub = this.hojas
      .facturas({
        hojaId: this.hoja._id,
        desde: this.filtrosFacturas.desde,
        hasta: this.filtrosFacturas.hasta,
        ...(refrescar ? { refrescar: "1" } : {}),
      })
      .pipe(timeout(190000))
      .subscribe({
        next: (res) => {
          const body = res.body || {};
          this.catalogoFacturas = body.facturas || [];
          this.tiposFactura = body.tipos || [];
          this.bodegasFactura = body.bodegas || [];
          this.vendedoresFactura = body.vendedores || [];
          this.avisoFacturas = body.aviso || "";
          this.cargandoFacturas = false;
          if (!refrescar && !this.catalogoFacturas.length) {
            this.cargarFacturas(true);
          }
        },
        error: (err) => {
          this.catalogoFacturas = [];
          this.cargandoFacturas = false;
          this.avisoFacturas =
            err?.name === "TimeoutError"
              ? "SIESA tardó demasiado. Pulse Actualizar SIESA e intente de nuevo."
              : err?.error?.body?.message || "No se pudieron leer las facturas SIESA.";
        },
      });
  }

  toggleFactura(numFactura: string) {
    if (this.seleccionFacturas.has(numFactura)) this.seleccionFacturas.delete(numFactura);
    else this.seleccionFacturas.add(numFactura);
  }

  seleccionarFacturasTodas() {
    this.seleccionFacturas = new Set(this.facturasFiltradas.map((item) => String(item.numFactura)));
  }

  seleccionarFacturasNinguna() {
    this.seleccionFacturas.clear();
  }

  agregarFacturasMarcadas() {
    const items = this.facturasFiltradas.filter((item) => this.seleccionFacturas.has(item.numFactura));
    if (!items.length) {
      this.toast("info", "Seleccione al menos una factura.");
      return;
    }
    this.hojas.agregarFacturas({ _id: this.hoja._id, items }).subscribe({
      next: (res) => {
        this.hoja = res.body;
        this.panelFacturas = false;
        this.seleccionFacturas.clear();
        this.toast(res.body?.aviso ? "info" : "success", res.body?.aviso || "Facturas agregadas.");
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudieron agregar las facturas"),
    });
  }

  pendiente(accion: string) {
    this.toast("info", `${accion}: pendiente. Aún no hay catálogo de ${accion.toLowerCase()}.`);
  }

  imprimirPdf() {
    const ventana = abrirVentanaImpresion("Generando hoja de ruta…");
    this.cargarImpresion(
      (data) => {
        if (!abrirRutero(data, ventana)) {
          this.toast("error", "No se pudo abrir el PDF. Permita ventanas emergentes e intente de nuevo.");
        }
      },
      () => ventana?.close()
    );
  }

  imprimirCertificados() {
    const ventana = abrirVentanaImpresion("Generando certificados de calidad…");
    this.cargarImpresion(
      (data) => {
        if (!abrirCertificados(data, ventana)) {
          this.toast("error", "No se pudo abrir el PDF. Permita ventanas emergentes e intente de nuevo.");
        }
      },
      () => ventana?.close()
    );
  }

  private cargarImpresion(ok: (data: any) => void, onError?: () => void) {
    if (!this.hoja?._id) return;
    this.hojas.impresion(this.hoja._id).subscribe({
      next: (res) => ok(res.body || res),
      error: (err) => {
        onError?.();
        this.toast("error", err?.error?.body?.message || "No se pudo armar la impresión");
      },
    });
  }

  agregarFactura() {
    const factura = this.factura.trim();
    if (!this.editable || !factura || this.agregandoFactura) return;
    this.agregandoFactura = true;
    this.hojas.agregarFactura({ _id: this.hoja._id, factura }).subscribe({
      next: (res) => {
        this.hoja = res.body;
        this.factura = "";
        this.agregandoFactura = false;
      },
      error: (err) => {
        this.agregandoFactura = false;
        this.toast("error", err?.error?.body?.message || "No se pudo agregar la factura");
      },
    });
  }

  abrirCargue() {
    if (!this.editable) return;
    this.panelCargue = true;
    this.cargandoDisponibles = true;
    this.hojas.disponibles(this.hoja._id).subscribe({
      next: (res) => {
        this.disponibles = res.body || [];
        for (const item of this.disponibles) {
          if (!this.facturas[item.pedidoIdEnc] && item.nroDoc) {
            this.facturas[item.pedidoIdEnc] = item.nroDoc;
          }
        }
        this.cargandoDisponibles = false;
      },
      error: (err) => {
        this.disponibles = [];
        this.cargandoDisponibles = false;
        this.toast("error", err?.error?.body?.message || "No hay pedidos despachados disponibles");
      },
    });
  }

  toggleDisponible(idEnc: string) {
    if (this.seleccionDisponibles.has(idEnc)) this.seleccionDisponibles.delete(idEnc);
    else this.seleccionDisponibles.add(idEnc);
  }

  agregarSeleccionados() {
    const items = [...this.seleccionDisponibles]
      .map((pedidoIdEnc) => {
        const item = this.disponibles.find((row) => row.pedidoIdEnc === pedidoIdEnc);
        return {
          pedidoIdEnc,
          nroFactura: String(this.facturas[pedidoIdEnc] || item?.nroDoc || "").trim(),
          tipoDoc: item?.tipoDoc || "",
        };
      })
      .filter((item) => item.nroFactura);
    if (!items.length) {
      this.toast("info", "Marque pedidos e indique el número de factura de cada uno.");
      return;
    }
    this.hojas.agregar({ _id: this.hoja._id, items }).subscribe({
      next: (res) => {
        this.hoja = res.body;
        this.panelCargue = false;
        this.seleccionDisponibles.clear();
        this.toast(res.body?.aviso ? "info" : "success", res.body?.aviso || "Documentos agregados.");
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudieron agregar"),
    });
  }

  toggleDoc(id: string, checked: boolean) {
    if (checked) this.seleccion.add(id);
    else this.seleccion.delete(id);
  }

  seleccionarTodos() {
    this.seleccion = new Set(this.documentos.map((doc: any) => String(doc._id)));
  }

  seleccionarNinguno() {
    this.seleccion.clear();
  }

  eliminarSeleccion() {
    const ids = [...this.seleccion];
    if (!ids.length) {
      this.toast("info", "Seleccione los documentos a eliminar.");
      return;
    }
    this.quitar(ids);
  }

  quitar(ids: string[]) {
    if (!this.editable || !ids.length) return;
    this.hojas.quitar({ _id: this.hoja._id, ids }).subscribe({
      next: (res) => {
        this.hoja = res.body;
        this.seleccion.clear();
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudieron quitar"),
    });
  }

  abrirVehiculo() {
    if (!this.editable) return;
    this.placaNueva = this.hoja.placa;
    this.panelVehiculo = true;
  }

  guardarVehiculo() {
    if (!this.placaNueva) return;
    this.hojas.actualizar({ _id: this.hoja._id, placa: this.placaNueva }).subscribe({
      next: (res) => {
        this.hoja = res.body;
        this.panelVehiculo = false;
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo cambiar el vehículo"),
    });
  }

  abrirDatos() {
    if (!this.editable) return;
    this.editNombre = this.hoja.nombre || "";
    this.editFecha = this.hoja.fecha || "";
    this.editPeso = this.hoja.pesoAdicional ?? 0;
    this.editTemperatura = this.hoja.temperatura || "";
    this.editCanastas = this.hoja.canastas || "";
    this.editBultos = this.hoja.bultos || "";
    this.editAuxiliar = this.hoja.auxiliar || "";
    this.editObservaciones = this.hoja.observaciones || "";
    this.editFirmanteCalidadId = this.hoja.firmanteCalidad?.firmanteId || "";
    this.editFirmanteLogisticaId = this.hoja.firmanteLogistica?.firmanteId || "";
    this.panelDatos = true;
  }

  guardarDatos() {
    this.hojas
      .actualizar({
        _id: this.hoja._id,
        nombre: this.editNombre,
        fecha: this.editFecha,
        pesoAdicional: this.editPeso,
        temperatura: this.editTemperatura,
        canastas: this.editCanastas,
        bultos: this.editBultos,
        auxiliar: this.editAuxiliar,
        observaciones: this.editObservaciones,
        firmanteCalidadId: this.editFirmanteCalidadId,
        firmanteLogisticaId: this.editFirmanteLogisticaId,
      })
      .subscribe({
        next: (res) => {
          this.hoja = res.body;
          this.panelDatos = false;
        },
        error: (err) => this.toast("error", err?.error?.body?.message || "No se pudieron guardar los datos"),
      });
  }

  guardar() {
    if (this.guardando) return;
    this.guardando = true;
    this.hojas.actualizar({ _id: this.hoja._id }).subscribe({
      next: () => {
        if (this.editable && this.documentos.length) {
          this.hojas.confirmar(this.hoja._id).subscribe({
            next: (res) => {
              this.hoja = res.body;
              this.guardando = false;
              this.modoAgregar = "";
              this.toast("success", "Hoja de ruta guardada.");
            },
            error: (err) => {
              this.guardando = false;
              this.toast("error", err?.error?.body?.message || "No se pudo confirmar");
            },
          });
          return;
        }
        this.guardando = false;
        this.toast("success", "Hoja de ruta guardada.");
      },
      error: (err) => {
        this.guardando = false;
        this.toast("error", err?.error?.body?.message || "No se pudo guardar");
      },
    });
  }

  dato(valor: any) {
    if (valor == null || valor === "") return "";
    return valor;
  }

  etiquetaVehiculo(item: any) {
    const ton = Number(item?.capacidad) || 0;
    return ton > 0 ? `${item.placa} · ${ton} t` : item.placa;
  }

  get usoTexto() {
    const hoja = this.hoja;
    if (!hoja?.capacidadKg) return "Sin capacidad del vehículo";
    const cargado = Number(hoja.pesoCargado || 0).toFixed(0);
    const cap = Number(hoja.capacidadKg).toFixed(0);
    return `${cargado} kg / ${cap} kg (${hoja.usoPorcentaje || 0}%)`;
  }

  get usoAncho() {
    return Math.min(100, Math.max(0, Number(this.hoja?.usoPorcentaje) || 0));
  }

  private toast(icon: "success" | "error" | "info", title: string) {
    Swal.fire({ toast: true, position: "top", icon, title, showConfirmButton: false, timer: 3200 });
  }
}
