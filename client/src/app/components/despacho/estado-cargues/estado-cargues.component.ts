import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterModule } from "@angular/router";
import { MaterialModule } from "../../../material.module";
import { CarguesService } from "../../../services/despacho/cargues.service";
import Swal from "sweetalert2";

@Component({
  selector: "app-estado-cargues",
  standalone: true,
  imports: [CommonModule, RouterModule, MaterialModule],
  templateUrl: "./estado-cargues.component.html",
  styleUrls: ["../despacho-page.css", "./estado-cargues.component.css"],
})
export class EstadoCarguesComponent implements OnInit {
  cargando = true;
  filas: any[] = [];
  filtro = "TODOS";

  constructor(private cargues: CarguesService, private router: Router) {}

  ngOnInit() {
    this.cargar();
  }

  get visibles() {
    if (this.filtro === "TODOS") return this.filas;
    return this.filas.filter((row) => row.estado === this.filtro);
  }

  cargar() {
    this.cargando = true;
    this.cargues.getEstadoCargues().subscribe({
      next: (res) => {
        this.filas = res.body || [];
        this.cargando = false;
      },
      error: (err) => {
        this.filas = [];
        this.cargando = false;
        Swal.fire({
          toast: true,
          position: "top",
          icon: "error",
          title: err?.error?.body?.message || "No se pudo leer el estado de los cargues",
          showConfirmButton: false,
          timer: 3000,
        });
      },
    });
  }

  etiqueta(estado: string) {
    if (estado === "COMPLETADO") return "Completado";
    if (estado === "EN_PROCESO") return "En proceso";
    return "En piso";
  }

  ver(row: any) {
    this.router.navigate(["/configuracion/despacho/estado-cargues", row._id]);
  }

  async devolver(row: any, ev?: Event) {
    ev?.stopPropagation();
    if (!row?._id || row.estado !== "COMPLETADO") return;
    const r = await Swal.fire({
      title: "Devolver a despachos",
      text: `El cargue ${row.idCargue} volverá al portal del despachador para poder pesarlo otra vez. Los pesajes actuales se conservan.`,
      showCancelButton: true,
      confirmButtonText: "Devolver",
      cancelButtonText: "Cancelar",
    });
    if (!r.isConfirmed) return;
    this.cargues.devolverADespachos(row._id).subscribe({
      next: () => {
        Swal.fire({
          toast: true,
          position: "top",
          icon: "success",
          title: "Cargue devuelto a despachos",
          showConfirmButton: false,
          timer: 2500,
        });
        this.cargar();
      },
      error: (err) =>
        Swal.fire({
          icon: "error",
          title: err?.error?.body?.message || "No se pudo devolver el cargue",
        }),
    });
  }
}
