import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { MaterialModule } from "../../../material.module";
import { ReaprovisionamientosService } from "../../../services/despacho/reaprovisionamientos.service";
import Swal from "sweetalert2";

@Component({
  selector: "app-reaprovisionamiento-detalle",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MaterialModule],
  templateUrl: "./reaprovisionamiento-detalle.component.html",
  styleUrls: [
    "../despacho-page.css",
    "../cargues/cargues.component.css",
    "../cargue-detalle/cargue-detalle.component.css",
    "./reaprovisionamiento-detalle.component.css",
  ],
})
export class ReaprovisionamientoDetalleComponent implements OnInit, OnDestroy {
  id = "";
  doc: any = null;
  cargando = true;
  guardando = false;
  observacion = "";
  busqueda = "";
  resultados: any[] = [];
  buscando = false;
  itemSel: any = null;
  unidades: number | null = null;
  kilos: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private reapro: ReaprovisionamientosService
  ) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get("id") || "";
    this.cargar();
  }

  ngOnDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  get editable() {
    return this.doc?.estado === "temporal";
  }

  get lineas() {
    return this.doc?.lineas || [];
  }

  get totalPeso() {
    return this.lineas.reduce((acc: number, linea: any) => acc + (Number(linea.kilos) || 0), 0);
  }

  get totalUnidades() {
    return this.lineas.reduce((acc: number, linea: any) => acc + (Number(linea.unidades) || 0), 0);
  }

  cargar() {
    this.cargando = true;
    this.reapro.get(this.id).subscribe({
      next: (res) => {
        this.doc = res.body;
        this.observacion = this.doc?.observacion || "";
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        this.toast("error", err?.error?.body?.message || "No se pudo leer el documento");
        this.router.navigate(["/configuracion/despacho/reaprovisionamiento"]);
      },
    });
  }

  onBuscar() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.buscar(), 280);
  }

  buscar() {
    const q = this.busqueda.trim();
    this.itemSel = null;
    if (q.length < 2) {
      this.resultados = [];
      return;
    }
    this.buscando = true;
    this.reapro.buscarItems(q).subscribe({
      next: (res) => {
        this.resultados = res.body || [];
        this.buscando = false;
      },
      error: () => {
        this.resultados = [];
        this.buscando = false;
      },
    });
  }

  elegirItem(item: any) {
    this.itemSel = item;
    this.busqueda = `${item.referencia || item.codigoItem || ""} ${item.descripcion || ""}`.trim();
    this.resultados = [];
  }

  agregarLinea() {
    if (!this.editable) return;
    if (!this.itemSel) {
      this.toast("info", "Busque y seleccione un ítem del catálogo.");
      return;
    }
    const unidades = Number(this.unidades);
    const kilos = Number(this.kilos);
    if ((!Number.isFinite(unidades) || unidades <= 0) && (!Number.isFinite(kilos) || kilos <= 0)) {
      this.toast("info", "Indique unidades o kilos.");
      return;
    }
    const referencia = String(this.itemSel.referencia || this.itemSel.codigoItem || this.itemSel.item || "").trim();
    if (this.lineas.some((linea: any) => String(linea.referencia) === referencia)) {
      this.toast("info", "Ese ítem ya está en el documento.");
      return;
    }
    const lineas = [
      ...this.lineas,
      {
        item: this.itemSel.item || "",
        codigoItem: this.itemSel.codigoItem || "",
        referencia,
        descripcion: this.itemSel.descripcion || "",
        undInventario: this.itemSel.undInventario || "",
        unidades: Number.isFinite(unidades) && unidades > 0 ? unidades : 0,
        kilos: Number.isFinite(kilos) && kilos > 0 ? kilos : 0,
      },
    ];
    this.guardar(lineas, () => {
      this.busqueda = "";
      this.itemSel = null;
      this.unidades = null;
      this.kilos = null;
      this.resultados = [];
    });
  }

  quitarLinea(linea: any) {
    if (!this.editable) return;
    const ref = String(linea.referencia || "");
    const lineas = this.lineas.filter((item: any) => String(item.referencia) !== ref);
    this.guardar(lineas);
  }

  onObsBlur() {
    if (this.editable) this.guardar(undefined, () => {});
  }

  guardar(lineas?: any[], luego?: () => void) {
    if (!this.editable || this.guardando) return;
    this.guardando = true;
    this.reapro
      .actualizar({
        _id: this.id,
        observacion: this.observacion,
        lineas: lineas || this.lineas,
      })
      .subscribe({
        next: (res) => {
          this.doc = res.body;
          this.observacion = this.doc?.observacion || "";
          this.guardando = false;
          if (luego) luego();
          else this.toast("success", "Guardado.");
        },
        error: (err) => {
          this.guardando = false;
          this.toast("error", err?.error?.body?.message || "No se pudo guardar");
        },
      });
  }

  aprobar() {
    if (!this.editable) return;
    const irAprobar = () => {
      this.reapro.aprobar(this.id).subscribe({
        next: (res) => {
          this.doc = res.body;
          this.toast("success", "Aprobado. Ya puede entrar a un cargue para despacho en piso.");
        },
        error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo aprobar"),
      });
    };
    Swal.fire({
      title: "¿Aprobar este reaprovisionamiento?",
      text: "Quedará listo para agregarlo a un cargue, pesarlo en piso y llevarlo a la hoja de ruta.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Aprobar",
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.reapro
        .actualizar({ _id: this.id, observacion: this.observacion, lineas: this.lineas })
        .subscribe({
          next: (res) => {
            this.doc = res.body;
            irAprobar();
          },
          error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo guardar"),
        });
    });
  }

  enviarSiesa() {
    if (this.doc?.estado !== "aprobado") {
      this.toast("info", "Apruebe el documento primero.");
      return;
    }
    this.reapro.enviarSiesa(this.id).subscribe({
      next: () => this.toast("success", "Enviado a SIESA."),
      error: (err) =>
        this.toast(
          "info",
          err?.error?.body?.message || "El envío a SIESA se conecta en un siguiente paso."
        ),
    });
  }

  anular() {
    Swal.fire({
      title: `¿Anular ${this.doc?.idEnc}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, anular",
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.reapro.anular(this.id).subscribe({
        next: () => {
          this.toast("success", "Anulado.");
          this.router.navigate(["/configuracion/despacho/reaprovisionamiento"]);
        },
        error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo anular"),
      });
    });
  }

  private toast(icon: "success" | "error" | "info", title: string) {
    Swal.fire({ toast: true, position: "top", icon, title, showConfirmButton: false, timer: 3200 });
  }
}
