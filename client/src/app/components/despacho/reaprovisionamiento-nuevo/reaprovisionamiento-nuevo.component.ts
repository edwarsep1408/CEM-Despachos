import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import { BodegasService } from "../../../services/bodegas/bodegas.service";
import { CarguesService } from "../../../services/despacho/cargues.service";
import { ReaprovisionamientosService } from "../../../services/despacho/reaprovisionamientos.service";
import Swal from "sweetalert2";

const hoy = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

@Component({
  selector: "app-reaprovisionamiento-nuevo",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./reaprovisionamiento-nuevo.component.html",
  styleUrls: ["../despacho-page.css", "../hoja-ruta-nueva/hoja-ruta-nueva.component.css"],
})
export class ReaprovisionamientoNuevoComponent implements OnInit {
  bodegas: { codigo: string; nombre: string }[] = [];
  fecha = hoy();
  bodegaOrigen = "";
  observacion = "";
  archivo: File | null = null;
  guardando = false;

  constructor(
    private bodegasService: BodegasService,
    private cargues: CarguesService,
    private reapro: ReaprovisionamientosService,
    private router: Router
  ) {}

  ngOnInit() {
    this.cargarBodegas();
  }

  etiqueta(item: { codigo: string; nombre: string }) {
    return item.nombre && item.nombre !== item.codigo ? `${item.codigo} · ${item.nombre}` : item.codigo;
  }

  onArchivo(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.archivo = input.files?.[0] || null;
  }

  aceptar() {
    if (!this.bodegaOrigen || !this.archivo || this.guardando) return;
    this.guardando = true;
    const origen = this.bodegas.find((item) => item.codigo === this.bodegaOrigen);
    this.reapro
      .importarExcel({
        archivo: this.archivo,
        fecha: this.fecha,
        bodegaOrigen: this.bodegaOrigen,
        bodegaOrigenNombre: origen?.nombre || "",
        observacion: this.observacion.trim(),
      })
      .subscribe({
        next: (res) => {
          const avisos = res.body?.avisos || [];
          if (avisos.length) {
            Swal.fire({
              icon: "info",
              title: "Reaprovisionamiento creado",
              text: avisos.slice(0, 8).join("\n") + (avisos.length > 8 ? `\n… y ${avisos.length - 8} más` : ""),
            }).then(() => this.router.navigate(["/configuracion/despacho/reaprovisionamiento", res.body._id]));
            return;
          }
          this.router.navigate(["/configuracion/despacho/reaprovisionamiento", res.body._id]);
        },
        error: (err) => {
          this.guardando = false;
          Swal.fire({
            icon: "error",
            title: err?.error?.body?.message || "No se pudo importar el Excel",
          });
        },
      });
  }

  private cargarBodegas() {
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

    this.cargues.getBodegasPedidos().subscribe({
      next: (res) => unir(res.body || []),
      error: () => {},
    });
  }
}
