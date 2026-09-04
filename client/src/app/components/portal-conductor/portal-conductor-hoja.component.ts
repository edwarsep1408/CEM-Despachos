import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterModule } from "@angular/router";
import { ConductorService } from "../../services/despacho/conductor.service";
import { SesionService } from "../../services/sesion/sesion.service";

@Component({
  selector: "app-portal-conductor-hoja",
  standalone: true,
  imports: [CommonModule, RouterModule],
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
        this.cargando = false;
      },
      error: (err) => {
        this.error = err?.error?.body?.message || "No se pudo leer la hoja de ruta.";
        this.cargando = false;
      },
    });
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

  abrir(doc: any) {
    if (!this.hoja?._id || !doc?.docId) return;
    this.router.navigate(["/portal-conductor", this.hoja._id, doc.docId]);
  }

  elegirHoja(h: any) {
    this.hoja = h;
  }

  salir() {
    this.sesion.cerrarSesion();
    this.router.navigateByUrl("/login-conductor");
  }
}
