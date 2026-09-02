import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MaterialModule } from "../../material.module";
import { SeguridadService } from "../../services/seguridad/seguridad.service";
import { BodegasService } from "../../services/bodegas/bodegas.service";
import { CarguesService } from "../../services/despacho/cargues.service";
import Swal from "sweetalert2";

@Component({
  selector: "app-asignacion-bodega",
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: "./asignacion-bodega.component.html",
  styleUrl: "./asignacion-bodega.component.css",
})
export class AsignacionBodegaComponent implements OnInit {
  cargando = true;
  despachadores: any[] = [];
  bodegas: { codigo: string; nombre: string }[] = [];
  seleccion: Record<string, string> = {};

  constructor(
    private seguridad: SeguridadService,
    private bodegasService: BodegasService,
    private cargues: CarguesService
  ) {}

  ngOnInit() {
    this.cargarBodegas();
    this.cargar();
  }

  toast(icon: "success" | "error" | "info", title: string) {
    Swal.fire({ toast: true, position: "top", icon, title, showConfirmButton: false, timer: 2800 });
  }

  cargarBodegas() {
    const unir = (lista: { codigo: string; nombre: string }[]) => {
      const mapa = new Map(this.bodegas.map((item) => [item.codigo, item]));
      for (const item of lista) {
        if (item.codigo && !mapa.has(item.codigo)) mapa.set(item.codigo, item);
      }
      this.bodegas = Array.from(mapa.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
    };

    this.bodegasService.onConsultarBodegas().subscribe({
      next: (res) => {
        unir(
          (res.body || []).map((item: any) => ({
            codigo: String(item.codigo || "").trim(),
            nombre: String(item.descripcion || item.nombre || "").trim(),
          }))
        );
      },
      error: () => {
        this.bodegasService.Get().subscribe({
          next: (res) =>
            unir(
              (res.body || []).map((item: any) => ({
                codigo: String(item.codigo || "").trim(),
                nombre: String(item.nombre || "").trim(),
              }))
            ),
          error: () => {},
        });
      },
    });

    this.bodegasService.Get().subscribe({
      next: (res) =>
        unir(
          (res.body || []).map((item: any) => ({
            codigo: String(item.codigo || "").trim(),
            nombre: String(item.nombre || "").trim(),
          }))
        ),
      error: () => {},
    });

    this.cargues.getBodegasPedidos().subscribe({
      next: (res) => unir(res.body || []),
      error: () => {},
    });
  }

  cargar() {
    this.cargando = true;
    this.seguridad.getDespachadores().subscribe({
      next: (res) => {
        this.despachadores = res.body || [];
        this.seleccion = {};
        for (const row of this.despachadores) {
          this.seleccion[row._id] = row.bodega || "";
        }
        this.cargando = false;
      },
      error: () => {
        this.despachadores = [];
        this.cargando = false;
      },
    });
  }

  nombreBodega(codigo: string) {
    return this.bodegas.find((item) => item.codigo === codigo)?.nombre || "";
  }

  guardar(row: any) {
    const bodega = this.seleccion[row._id] || "";
    this.seguridad
      .putAsignacionBodega({
        _id: row._id,
        bodega,
        bodegaNombre: this.nombreBodega(bodega),
      })
      .subscribe({
        next: () => {
          this.toast("success", "Bodega asignada");
          this.cargar();
        },
        error: (err) =>
          this.toast("error", err?.error?.body?.message || "No se pudo guardar"),
      });
  }
}
