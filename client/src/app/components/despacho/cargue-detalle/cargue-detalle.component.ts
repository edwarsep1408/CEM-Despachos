import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { MaterialModule } from "../../../material.module";
import { CarguesService } from "../../../services/despacho/cargues.service";
import { etiquetaPedido } from "../../../core/etiqueta-docto";
import Swal from "sweetalert2";

type TipoDoc = "PEDIDO" | "REAPRO" | "OC" | "TRANSITO";

@Component({
  selector: "app-cargue-detalle",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MaterialModule],
  templateUrl: "./cargue-detalle.component.html",
  styleUrls: ["../despacho-page.css", "./cargue-detalle.component.css"],
})
export class CargueDetalleComponent implements OnInit {
  id = "";
  cargue: any = null;
  cargando = true;
  seleccion = new Set<string>();
  panelAbierto = false;
  panelTipo: TipoDoc = "PEDIDO";
  disponibles: any[] = [];
  seleccionDisponibles = new Set<string>();
  cargandoDisponibles = false;
  pagina = 1;
  porPagina = 20;
  etiquetaPedido = etiquetaPedido;
  filtros = {
    desde: "",
    hasta: "",
    vendedor: "",
    cliente: "",
    pedido: "",
    barrio: "",
    municipio: "",
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cargues: CarguesService
  ) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get("id") || "";
    this.cargar();
  }

  toast(icon: "success" | "error" | "info", title: string) {
    Swal.fire({ toast: true, position: "top", icon, title, showConfirmButton: false, timer: 2800 });
  }

  get documentos() {
    return this.cargue?.documentos || [];
  }

  get totalPeso() {
    return Number(this.cargue?.totalPeso || 0).toFixed(2);
  }

  get vendedores() {
    return [...new Set(this.disponibles.map((item) => item.codigo || item.vendedor).filter(Boolean))].sort();
  }

  get disponiblesFiltrados() {
    return this.disponibles.filter((item) => {
      if (this.filtros.desde && String(item.fecha || "") < this.filtros.desde) return false;
      if (this.filtros.hasta && String(item.fecha || "") > this.filtros.hasta) return false;
      if (this.filtros.vendedor) {
        const cod = String(item.codigo || item.vendedor || "");
        if (cod !== this.filtros.vendedor) return false;
      }
      if (this.filtros.cliente) {
        const q = this.filtros.cliente.toLowerCase();
        const hay =
          String(item.cliente || "").toLowerCase().includes(q) ||
          String(item.codigoCliente || item.nit || "").toLowerCase().includes(q);
        if (!hay) return false;
      }
      if (
        this.filtros.pedido &&
        !String(item.nroDoc || item.idEnc || "").includes(this.filtros.pedido.trim()) &&
        !etiquetaPedido(item).toLowerCase().includes(this.filtros.pedido.trim().toLowerCase())
      ) {
        return false;
      }
      if (this.filtros.barrio && !String(item.barrio || "").toLowerCase().includes(this.filtros.barrio.toLowerCase())) {
        return false;
      }
      if (
        this.filtros.municipio &&
        !String(item.municipio || "").toLowerCase().includes(this.filtros.municipio.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }

  get totalPaginas() {
    return Math.max(1, Math.ceil(this.disponiblesFiltrados.length / this.porPagina));
  }

  get paginaItems() {
    const inicio = (this.pagina - 1) * this.porPagina;
    return this.disponiblesFiltrados.slice(inicio, inicio + this.porPagina);
  }

  aplicarFiltros() {
    this.pagina = 1;
  }

  get seleccionCount() {
    return this.seleccionDisponibles.size;
  }

  get seleccionPeso() {
    return this.disponibles
      .filter((item) => this.seleccionDisponibles.has(item.idEnc))
      .reduce((acc, item) => acc + (Number(item.peso) || 0), 0);
  }

  get seleccionValor() {
    return this.disponibles
      .filter((item) => this.seleccionDisponibles.has(item.idEnc))
      .reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
  }

  get tituloPanel() {
    if (this.panelTipo === "OC") return "Agregar órdenes de compra";
    if (this.panelTipo === "TRANSITO") return "Agregar salidas en tránsito y transferencias";
    if (this.panelTipo === "REAPRO") return "Agregar reaprovisionamiento CEDIS";
    return "Agregar pedidos";
  }

  cargar() {
    this.cargando = true;
    this.cargues.getCargue(this.id).subscribe({
      next: (res) => {
        this.cargue = res.body;
        this.seleccion.clear();
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        this.toast("error", err?.error?.body?.message || "No se pudo leer el cargue");
        this.router.navigate(["/configuracion/despacho/cargues"]);
      },
    });
  }

  abrirPanel(tipo: TipoDoc) {
    this.panelTipo = tipo;
    this.panelAbierto = true;
    this.seleccionDisponibles = new Set();
    this.disponibles = [];
    this.pagina = 1;
    this.filtros = {
      desde: "",
      hasta: "",
      vendedor: "",
      cliente: "",
      pedido: "",
      barrio: "",
      municipio: "",
    };
    if (tipo !== "PEDIDO" && tipo !== "REAPRO") return;
    this.cargandoDisponibles = true;
    this.cargues.getDocumentos(this.id, tipo).subscribe({
      next: (res) => {
        this.disponibles = res.body || [];
        const fechas = this.disponibles.map((item) => String(item.fecha || "")).filter(Boolean).sort();
        this.filtros.desde = fechas[0] || "";
        this.filtros.hasta = fechas[fechas.length - 1] || "";
        this.cargandoDisponibles = false;
      },
      error: (err) => {
        this.cargandoDisponibles = false;
        this.toast("error", err?.error?.body?.message || "No se pudieron leer los documentos");
      },
    });
  }

  toggleDisponible(idEnc: string) {
    const next = new Set(this.seleccionDisponibles);
    if (next.has(idEnc)) next.delete(idEnc);
    else next.add(idEnc);
    this.seleccionDisponibles = next;
  }

  todosDisponibles() {
    const next = new Set(this.seleccionDisponibles);
    for (const item of this.disponiblesFiltrados) next.add(item.idEnc);
    this.seleccionDisponibles = next;
  }

  ningunoDisponibles() {
    this.seleccionDisponibles = new Set();
  }

  agregarTodos() {
    const ids = this.disponiblesFiltrados.map((item) => item.idEnc);
    this.seleccionDisponibles = new Set(ids);
    this.agregarSeleccionados();
  }

  agregarSeleccionados() {
    const ids = Array.from(this.seleccionDisponibles);
    if (!ids.length) {
      this.toast("info", this.panelTipo === "REAPRO" ? "Seleccione al menos un reaprovisionamiento" : "Seleccione al menos un pedido");
      return;
    }
    this.cargues.agregarDocumentos({ _id: this.id, tipo: this.panelTipo, ids }).subscribe({
      next: (res) => {
        this.cargue = res.body;
        this.panelAbierto = false;
        this.toast("success", this.panelTipo === "REAPRO" ? "Reaprovisionamientos agregados" : "Pedidos agregados");
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudieron agregar"),
    });
  }

  irPagina(pagina: number) {
    this.pagina = Math.min(this.totalPaginas, Math.max(1, pagina));
  }

  toggleFila(id: string) {
    const next = new Set(this.seleccion);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.seleccion = next;
  }

  seleccionarTodos() {
    this.seleccion = new Set(this.documentos.map((doc: any) => String(doc._id)));
  }

  seleccionarNinguno() {
    this.seleccion = new Set();
  }

  eliminar(ids?: string[]) {
    const lista = ids || Array.from(this.seleccion);
    if (!lista.length) {
      this.toast("info", "Seleccione documentos para eliminar");
      return;
    }
    this.cargues.eliminarDocumentos({ _id: this.id, ids: lista }).subscribe({
      next: (res) => {
        this.cargue = res.body;
        this.seleccion.clear();
        this.toast("success", "Documentos eliminados");
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudieron eliminar"),
    });
  }

  enviar() {
    Swal.fire({
      title: "¿Guardar y enviar a despachos?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Enviar",
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.cargues.enviar(this.id).subscribe({
        next: () => {
          this.toast("success", "Cargue enviado");
          this.router.navigate(["/configuracion/despacho/cargues"]);
        },
        error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo enviar"),
      });
    });
  }
}
