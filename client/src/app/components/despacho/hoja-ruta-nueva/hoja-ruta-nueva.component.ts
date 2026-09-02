import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import { HojasRutaService } from "../../../services/despacho/hojas-ruta.service";
import { FirmantesService } from "../../../services/despacho/firmantes.service";
import Swal from "sweetalert2";

const hoy = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

@Component({
  selector: "app-hoja-ruta-nueva",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./hoja-ruta-nueva.component.html",
  styleUrls: ["../despacho-page.css", "./hoja-ruta-nueva.component.css"],
})
export class HojaRutaNuevaComponent implements OnInit {
  vehiculos: any[] = [];
  firmantesCalidad: any[] = [];
  firmantesLogistica: any[] = [];
  placa = "";
  fecha = hoy();
  nombre = "";
  pesoAdicional: number | null = null;
  temperatura = "";
  firmanteCalidadId = "";
  firmanteLogisticaId = "";
  guardando = false;

  get vehiculoSel() {
    return this.vehiculos.find((item) => item.placa === this.placa) || null;
  }

  etiquetaVehiculo(item: any) {
    const ton = Number(item?.capacidad) || 0;
    return ton > 0 ? `${item.placa} · ${ton} t` : item.placa;
  }

  constructor(
    private hojas: HojasRutaService,
    private firmantes: FirmantesService,
    private router: Router
  ) {}

  ngOnInit() {
    this.hojas.vehiculos().subscribe({
      next: (res) => {
        this.vehiculos = res.body || [];
      },
      error: () => {
        this.vehiculos = [];
      },
    });
    this.firmantes.listar().subscribe({
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

  aceptar() {
    if (!this.placa || !this.nombre.trim() || this.guardando) return;
    this.guardando = true;
    this.hojas
      .crear({
        placa: this.placa,
        fecha: this.fecha,
        nombre: this.nombre.trim(),
        pesoAdicional: this.pesoAdicional,
        temperatura: this.temperatura,
        firmanteCalidadId: this.firmanteCalidadId,
        firmanteLogisticaId: this.firmanteLogisticaId,
      })
      .subscribe({
        next: (res) => {
          this.router.navigate(["/configuracion/despacho/hojas-de-ruta", res.body._id]);
        },
        error: (err) => {
          this.guardando = false;
          Swal.fire({
            icon: "error",
            title: err?.error?.body?.message || "No se pudo crear la hoja de ruta",
          });
        },
      });
  }
}
