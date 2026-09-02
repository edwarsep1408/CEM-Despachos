import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import { MaterialModule } from "../../../material.module";
import { HojasRutaService } from "../../../services/despacho/hojas-ruta.service";
import { abrirVentanaImpresion, imprimirCertificados, imprimirRutero } from "../../../services/despacho/hoja-impresion";
import { etiquetaPedido } from "../../../core/etiqueta-docto";
import Swal from "sweetalert2";

type VistaHoja = "vigente" | "temporal" | "anulada";

@Component({
  selector: "app-hojas-de-ruta",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MaterialModule],
  templateUrl: "./hojas-de-ruta.component.html",
  styleUrls: ["../despacho-page.css", "../cargues/cargues.component.css", "./hojas-de-ruta.component.css"],
})
export class HojasDeRutaComponent implements OnInit {
  vista: VistaHoja = "vigente";
  cargando = true;
  filas: any[] = [];
  seleccion = new Set<string>();
  filtros = { desde: "", hasta: "", nombre: "", placa: "" };

  constructor(private hojas: HojasRutaService, private router: Router) {}

  ngOnInit() {
    this.cargar();
  }

  get titulo() {
    if (this.vista === "temporal") return "Hojas de ruta temporales";
    if (this.vista === "anulada") return "Hojas de ruta anuladas";
    return "Hojas de ruta";
  }

  cambiarVista(vista: VistaHoja) {
    this.vista = vista;
    this.seleccion.clear();
    this.cargar();
  }

  cargar() {
    this.cargando = true;
    this.hojas.listar({ estado: this.vista, ...this.filtros }).subscribe({
      next: (res) => {
        this.filas = res.body || [];
        this.cargando = false;
        this.seleccion.clear();
      },
      error: (err) => {
        this.filas = [];
        this.cargando = false;
        this.toast("error", err?.error?.body?.message || "No se pudieron leer las hojas de ruta");
      },
    });
  }

  ver(row: any) {
    this.router.navigate(["/configuracion/despacho/hojas-de-ruta", row._id]);
  }

  toggle(id: string, checked: boolean) {
    if (checked) this.seleccion.add(id);
    else this.seleccion.delete(id);
  }

  seleccionarTodos() {
    this.filas.forEach((row) => this.seleccion.add(row._id));
  }

  seleccionarNinguno() {
    this.seleccion.clear();
  }

  certCalidad(row: any) {
    const ventana = abrirVentanaImpresion("Generando certificados de calidad…");
    this.hojas.impresion(row._id).subscribe({
      next: (res) => {
        if (!imprimirCertificados(res.body, ventana)) {
          this.toast("error", "No se pudo abrir el PDF. Permita ventanas emergentes e intente de nuevo.");
        }
      },
      error: (err) => {
        ventana?.close();
        this.toast("error", err?.error?.body?.message || "No se pudo armar el certificado");
      },
    });
  }

  exportarPdf() {
    const ids = this.seleccion.size ? [...this.seleccion] : this.filas.slice(0, 1).map((row) => row._id);
    if (!ids.length) {
      this.toast("info", "No hay hojas para imprimir.");
      return;
    }
    const ventana = abrirVentanaImpresion("Generando hoja de ruta…");
    this.hojas.impresion(ids[0]).subscribe({
      next: (res) => {
        if (!imprimirRutero(res.body, ventana)) {
          this.toast("error", "No se pudo abrir el PDF. Permita ventanas emergentes e intente de nuevo.");
        }
      },
      error: (err) => {
        ventana?.close();
        this.toast("error", err?.error?.body?.message || "No se pudo armar el rutero");
      },
    });
  }

  listaPesos(row: any) {
    this.hojas.get(row._id).subscribe({
      next: (res) => {
        const docs = res.body?.documentos || [];
        if (!docs.length) {
          this.toast("info", "Esta hoja aún no tiene pedidos.");
          return;
        }
        const filas = docs
          .map(
            (doc: any) =>
              `<tr><td>${etiquetaPedido(doc)}</td><td>${doc.nroFactura || "—"}</td><td>${doc.cliente || ""}</td><td>${Number(doc.peso || 0).toFixed(2)}</td></tr>`
          )
          .join("");
        const ventana = window.open("", "_blank", "width=720,height=640");
        if (!ventana) return;
        ventana.document.write(`<!doctype html><html><head><title>Lista de pesos ${row.idHoja}</title>
          <style>body{font-family:Arial,sans-serif;padding:16px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #1d4f91;padding:6px;text-align:left}th{background:#8ec3e6}</style>
          </head><body><h2>Lista de pesos · Hoja ${row.idHoja}</h2>
          <p>${row.nombre} · ${row.placa} · ${row.fecha}</p>
          <table><thead><tr><th>PEDIDO</th><th>FACTURA</th><th>CLIENTE</th><th>PESO</th></tr></thead>
          <tbody>${filas}</tbody></table></body></html>`);
        ventana.document.close();
        ventana.focus();
        setTimeout(() => ventana.print(), 300);
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo leer la hoja"),
    });
  }

  anular(row: any) {
    Swal.fire({
      title: `¿Anular la hoja ${row.idHoja}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, anular",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.hojas.anular(row._id).subscribe({
        next: () => {
          this.toast("success", "Hoja anulada.");
          this.cargar();
        },
        error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo anular"),
      });
    });
  }

  consolidar() {
    this.toast("info", "Consolidar y XML se definen cuando esté el cruce con facturación SIESA.");
  }

  private toast(icon: "success" | "error" | "info", title: string) {
    Swal.fire({ toast: true, position: "top", icon, title, showConfirmButton: false, timer: 3000 });
  }
}
