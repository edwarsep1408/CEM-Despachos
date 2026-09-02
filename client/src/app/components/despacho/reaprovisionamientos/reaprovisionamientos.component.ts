import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import { MaterialModule } from "../../../material.module";
import { ReaprovisionamientosService } from "../../../services/despacho/reaprovisionamientos.service";
import Swal from "sweetalert2";

type VistaReapro = "aprobado" | "temporal" | "anulado";

@Component({
  selector: "app-reaprovisionamientos",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MaterialModule],
  templateUrl: "./reaprovisionamientos.component.html",
  styleUrls: ["../despacho-page.css", "../cargues/cargues.component.css", "../hojas-de-ruta/hojas-de-ruta.component.css"],
})
export class ReaprovisionamientosComponent implements OnInit {
  vista: VistaReapro = "aprobado";
  cargando = true;
  filas: any[] = [];
  filtros = { desde: "", hasta: "", origen: "", destino: "" };

  constructor(private reapro: ReaprovisionamientosService, private router: Router) {}

  ngOnInit() {
    this.cargar();
  }

  get titulo() {
    if (this.vista === "temporal") return "Reaprovisionamientos temporales";
    if (this.vista === "anulado") return "Reaprovisionamientos anulados";
    return "Reaprovisionamiento CEDIS";
  }

  cambiarVista(vista: VistaReapro) {
    this.vista = vista;
    this.cargar();
  }

  cargar() {
    this.cargando = true;
    this.reapro.listar({ estado: this.vista, ...this.filtros }).subscribe({
      next: (res) => {
        this.filas = res.body || [];
        this.cargando = false;
      },
      error: (err) => {
        this.filas = [];
        this.cargando = false;
        this.toast("error", err?.error?.body?.message || "No se pudieron leer los reaprovisionamientos");
      },
    });
  }

  ver(row: any) {
    this.router.navigate(["/configuracion/despacho/reaprovisionamiento", row._id]);
  }

  anular(row: any) {
    Swal.fire({
      title: `¿Anular ${row.idEnc}?`,
      text: "Dejará de poder entrar a un cargue.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, anular",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.reapro.anular(row._id).subscribe({
        next: () => {
          this.toast("success", "Anulado.");
          this.cargar();
        },
        error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo anular"),
      });
    });
  }

  etiquetaSiesa(row: any) {
    const estado = String(row?.envioSiesa?.estado || "pendiente");
    if (estado === "enviado") return "enviado";
    if (estado === "error") return "error";
    return "pendiente";
  }

  private toast(icon: "success" | "error" | "info", title: string) {
    Swal.fire({ toast: true, position: "top", icon, title, showConfirmButton: false, timer: 3000 });
  }
}
