import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterModule } from "@angular/router";
import { MaterialModule } from "../../../material.module";
import { CarguesService } from "../../../services/despacho/cargues.service";
import Swal from "sweetalert2";

@Component({
  selector: "app-cargues",
  standalone: true,
  imports: [CommonModule, RouterModule, MaterialModule],
  templateUrl: "./cargues.component.html",
  styleUrls: ["../despacho-page.css", "./cargues.component.css"],
})
export class CarguesComponent implements OnInit {
  cargando = true;
  filas: any[] = [];

  constructor(private cargues: CarguesService, private router: Router) {}

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.cargando = true;
    this.cargues.getPendientes().subscribe({
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
          title: err?.error?.body?.message || "No se pudieron leer los cargues",
          showConfirmButton: false,
          timer: 3000,
        });
      },
    });
  }

  ver(row: any) {
    this.router.navigate(["/configuracion/despacho/cargues", row._id]);
  }
}
