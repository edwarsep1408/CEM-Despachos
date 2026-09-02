import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MaterialModule } from "../../../material.module";
import { PedidosService } from "../../../services/despacho/pedidos.service";
import { etiquetaPedido } from "../../../core/etiqueta-docto";
import Swal from "sweetalert2";

type VistaCompromiso = "despachado" | "comprometido" | "cumplido" | "log";

@Component({
  selector: "app-compromisos-pedidos",
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: "./compromisos-pedidos.component.html",
  styleUrls: [
    "../despacho-page.css",
    "../cargues/cargues.component.css",
    "../hojas-de-ruta/hojas-de-ruta.component.css",
    "./compromisos-pedidos.component.css",
  ],
})
export class CompromisosPedidosComponent implements OnInit {
  vista: VistaCompromiso = "despachado";
  cargando = true;
  enviando = false;
  filas: any[] = [];
  logs: any[] = [];
  detalle: any = null;
  seleccion = new Set<string>();
  filtros = { desde: "", hasta: "", pedido: "" };
  etiquetaPedido = etiquetaPedido;

  constructor(private pedidos: PedidosService) {}

  ngOnInit() {
    this.cargar();
  }

  get titulo() {
    if (this.vista === "comprometido") return "Pedidos comprometidos";
    if (this.vista === "cumplido") return "Pedidos cumplidos";
    if (this.vista === "log") return "Log de envíos a SIESA";
    return "Enviar compromisos de pedidos";
  }

  get subtitulo() {
    if (this.vista === "log") {
      return "Cada intento queda guardado con lo enviado y la respuesta de SIESA, para corregir el pedido o el maestro y volver a enviar.";
    }
    return "Los pesos y unidades capturados en piso se envían a SIESA. Si falta CO, ítem, bodega o unidad, el pedido no se marca comprometido.";
  }

  cambiarVista(vista: VistaCompromiso) {
    this.vista = vista;
    this.seleccion.clear();
    this.detalle = null;
    if (vista !== "log") this.filtros.pedido = "";
    this.cargar();
  }

  cargar() {
    this.cargando = true;
    this.detalle = null;
    if (this.vista === "log") {
      this.pedidos
        .getCompromisosLog({
          idEnc: this.filtros.pedido.trim(),
          desde: this.filtros.desde,
          hasta: this.filtros.hasta,
        })
        .subscribe({
          next: (res) => {
            this.logs = res.body || [];
            this.cargando = false;
            if (this.logs.length === 1) this.detalle = this.logs[0];
          },
          error: (err) => {
            this.logs = [];
            this.cargando = false;
            this.toast("error", err?.error?.body?.message || "No se pudo leer el log");
          },
        });
      return;
    }
    this.pedidos.getCompromisos({ estado: this.vista, ...this.filtros }).subscribe({
      next: (res) => {
        this.filas = res.body || [];
        this.cargando = false;
      },
      error: (err) => {
        this.filas = [];
        this.cargando = false;
        this.toast("error", err?.error?.body?.message || "No se pudieron leer los pedidos");
      },
    });
  }

  estaSel(idEnc: string) {
    return this.seleccion.has(idEnc);
  }

  toggleSel(idEnc: string, on: boolean) {
    if (on) this.seleccion.add(idEnc);
    else this.seleccion.delete(idEnc);
  }

  seleccionarTodos() {
    this.filas.forEach((row) => this.seleccion.add(row.idEnc));
  }

  seleccionarNinguno() {
    this.seleccion.clear();
  }

  comprometerUno(row: any) {
    this.enviar([row.idEnc]);
  }

  comprometerMarcados() {
    this.enviar([...this.seleccion]);
  }

  verLogPedido(row: any) {
    this.filtros.pedido = String(row?.idEnc || "").trim();
    this.cambiarVista("log");
  }

  abrirDetalle(log: any) {
    this.detalle = this.detalle?._id === log?._id ? null : log;
  }

  etiquetaResultado(valor: string) {
    const v = String(valor || "").toLowerCase();
    if (v === "enviado") return "Enviado";
    if (v === "validacion") return "Datos incompletos";
    if (v === "omitido") return "No enviado";
    return "Error SIESA";
  }

  copiarEnviado(log: any) {
    const texto = JSON.stringify(log?.payload || log?.lineas || {}, null, 2);
    navigator.clipboard.writeText(texto).then(
      () => this.toast("success", "Lo enviado se copió al portapapeles."),
      () => this.toast("error", "No se pudo copiar.")
    );
  }

  private enviar(ids: string[]) {
    if (!ids.length) {
      this.toast("info", "Seleccione al menos un pedido despachado.");
      return;
    }
    this.enviando = true;
    this.pedidos.comprometer(ids).subscribe({
      next: (res) => {
        this.enviando = false;
        this.seleccion.clear();
        const body = res?.body || {};
        const fallidos = body.fallidos || [];
        if (fallidos.length) {
          Swal.fire({
            icon: body.enviados?.length ? "warning" : "error",
            title: body.message || "No se pudo enviar a SIESA",
            html:
              fallidos.map((f: { idEnc?: string; mensaje?: string }) => `<div><b>${f.idEnc}</b>: ${f.mensaje || ""}</div>`).join("") +
              '<p class="mt-2 mb-0">El detalle queda en <b>Ver log</b> para corregir y reenviar.</p>',
          });
          this.vista = "log";
          if (fallidos.length === 1) this.filtros.pedido = String(fallidos[0].idEnc || "");
        } else {
          this.toast("success", body.message || "Pedidos enviados a SIESA.");
          this.vista = "comprometido";
        }
        this.cargar();
      },
      error: (err) => {
        this.enviando = false;
        Swal.fire({
          icon: "error",
          title: "No se pudieron comprometer",
          html:
            (err?.error?.body?.message || "No se pudieron comprometer") +
            '<p class="mt-2 mb-0">Revise <b>Ver log</b> para corregir y reenviar.</p>',
        });
        this.vista = "log";
        this.cargar();
      },
    });
  }

  private toast(icon: "success" | "error" | "info", title: string) {
    Swal.fire({ toast: true, position: "top", icon, title, showConfirmButton: false, timer: 3500 });
  }
}
