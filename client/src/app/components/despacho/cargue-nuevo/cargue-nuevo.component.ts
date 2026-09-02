import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import { CarguesService } from "../../../services/despacho/cargues.service";
import { SeguridadService } from "../../../services/seguridad/seguridad.service";
import Swal from "sweetalert2";

@Component({
  selector: "app-cargue-nuevo",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./cargue-nuevo.component.html",
  styleUrls: ["../despacho-page.css", "./cargue-nuevo.component.css"],
})
export class CargueNuevoComponent implements OnInit {
  despachadorId = "";
  despachadores: any[] = [];
  guardando = false;

  constructor(
    private seguridad: SeguridadService,
    private cargues: CarguesService,
    private router: Router
  ) {}

  ngOnInit() {
    this.seguridad.getDespachadores().subscribe({
      next: (res) => (this.despachadores = res.body || []),
      error: () => (this.despachadores = []),
    });
  }

  get seleccionado() {
    return this.despachadores.find((item) => item._id === this.despachadorId);
  }

  aceptar() {
    if (!this.despachadorId || this.guardando) return;
    const row = this.seleccionado;
    if (row && !row.bodega) {
      Swal.fire({
        icon: "info",
        title: "Sin bodega",
        text: "Asigne una bodega a este despachador en Asignación de bodega.",
      });
      return;
    }
    this.guardando = true;
    this.cargues.postCargue(this.despachadorId).subscribe({
      next: (res) => {
        this.router.navigate(["/configuracion/despacho/cargues", res.body._id]);
      },
      error: (err) => {
        this.guardando = false;
        Swal.fire({
          icon: "error",
          title: err?.error?.body?.message || "No se pudo crear el cargue",
        });
      },
    });
  }
}
