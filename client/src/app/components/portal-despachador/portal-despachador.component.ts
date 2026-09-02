import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterModule } from "@angular/router";
import { MuellesService } from "../../services/muelles/muelles.service";
import { SesionService } from "../../services/sesion/sesion.service";
import { PisoBrandComponent } from "./piso-brand.component";
import { pedirMuellePiso } from "./piso-ui";

@Component({
  selector: "app-portal-despachador",
  standalone: true,
  imports: [CommonModule, RouterModule, PisoBrandComponent],
  templateUrl: "./portal-despachador.component.html",
  styleUrl: "./piso-portal.css",
})
export class PortalDespachadorComponent implements OnInit {
  listo = false;
  mensaje = "Seleccione el muelle…";

  constructor(
    private muelles: MuellesService,
    private sesion: SesionService,
    private router: Router
  ) {}

  async ngOnInit() {
    const id = await pedirMuellePiso(this.muelles);
    if (!id) {
      this.sesion.cerrarSesion();
      this.router.navigateByUrl("/login");
      return;
    }
    this.listo = true;
  }
}
