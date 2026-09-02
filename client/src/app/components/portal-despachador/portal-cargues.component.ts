import { Component, HostListener, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterModule } from "@angular/router";
import { PisoService } from "../../services/despacho/piso.service";
import { SesionService } from "../../services/sesion/sesion.service";
import { MuellesService } from "../../services/muelles/muelles.service";
import { PisoBrandComponent } from "./piso-brand.component";
import {
  atajoBloqueado,
  etiquetaCargue,
  leerNombreMuellePiso,
  mensajeApi,
  pedirMuellePiso,
} from "./piso-ui";

@Component({
  selector: "app-portal-cargues",
  standalone: true,
  imports: [CommonModule, RouterModule, PisoBrandComponent],
  templateUrl: "./portal-cargues.component.html",
  styleUrl: "./piso-portal.css",
})
export class PortalCarguesComponent implements OnInit {
  cargues: any[] = [];
  sel = 0;
  error = "";
  cargando = true;
  muelleNombre = "";

  etiquetaCargue = etiquetaCargue;

  constructor(
    private piso: PisoService,
    private router: Router,
    private sesion: SesionService,
    private muellesApi: MuellesService
  ) {}

  ngOnInit(): void {
    this.muelleNombre = leerNombreMuellePiso();
    this.piso.getCargues().subscribe({
      next: (res) => {
        this.cargues = res?.body || [];
        this.cargando = false;
      },
      error: (err) => {
        this.error = mensajeApi(err, "No se pudieron leer los cargues.");
        this.cargando = false;
      },
    });
  }

  async cambiarMuelle() {
    const id = await pedirMuellePiso(this.muellesApi, { forzar: true });
    if (!id) return;
    this.muelleNombre = leerNombreMuellePiso();
  }

  abrir(row?: any) {
    const item = row || this.cargues[this.sel];
    if (!item?._id) return;
    this.router.navigate(["/portal-despachador", item._id]);
  }

  salir() {
    this.sesion.cerrarSesion();
    this.router.navigateByUrl("/login");
  }

  @HostListener("window:keydown", ["$event"])
  onKey(ev: KeyboardEvent) {
    if (atajoBloqueado(ev)) return;
    if (ev.key === "F10") {
      ev.preventDefault();
      this.salir();
      return;
    }
    if (!this.cargues.length) return;
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      this.sel = Math.min(this.sel + 1, this.cargues.length - 1);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      this.sel = Math.max(this.sel - 1, 0);
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      this.abrir();
    }
  }
}
