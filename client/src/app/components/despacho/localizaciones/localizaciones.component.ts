import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MaterialModule } from "../../../material.module";
import { LocalizacionesService } from "../../../services/despacho/localizaciones.service";
import Swal from "sweetalert2";

const vacio = () => ({
  codigoDep: "",
  gln: "",
  dependencia: "",
  cadena: "",
  zona: "",
});

@Component({
  selector: "app-localizaciones",
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: "./localizaciones.component.html",
  styleUrls: ["../despacho-page.css", "../cargues/cargues.component.css"],
})
export class LocalizacionesComponent implements OnInit {
  filas: any[] = [];
  cargando = true;
  importando = false;
  filtros = { q: "", cadena: "", zona: "" };
  panel: "nuevo" | "editar" | "" = "";
  form = vacio();
  editId = "";

  constructor(private loc: LocalizacionesService) {}

  ngOnInit() {
    this.cargar();
  }

  get visibles() {
    const q = this.filtros.q.trim().toLowerCase();
    const cadena = this.filtros.cadena.trim().toLowerCase();
    const zona = this.filtros.zona.trim().toLowerCase();
    return this.filas.filter((row) => {
      if (cadena && !String(row.cadena || "").toLowerCase().includes(cadena)) return false;
      if (zona && !String(row.zona || "").toLowerCase().includes(zona)) return false;
      if (!q) return true;
      const blob = `${row.codigoDep || ""} ${row.gln || ""} ${row.dependencia || ""} ${row.cadena || ""} ${row.zona || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }

  cargar() {
    this.cargando = true;
    this.loc.listar().subscribe({
      next: (res) => {
        this.filas = res.body || [];
        this.cargando = false;
      },
      error: (err) => {
        this.filas = [];
        this.cargando = false;
        this.toast("error", err?.error?.body?.message || "No se pudieron leer las localizaciones");
      },
    });
  }

  abrirNuevo() {
    this.editId = "";
    this.form = vacio();
    this.panel = "nuevo";
  }

  abrirEditar(row: any) {
    this.editId = row._id;
    this.form = {
      codigoDep: row.codigoDep || "",
      gln: row.gln || "",
      dependencia: row.dependencia || "",
      cadena: row.cadena || "",
      zona: row.zona || "",
    };
    this.panel = "editar";
  }

  cancelar() {
    this.panel = "";
    this.editId = "";
    this.form = vacio();
  }

  guardar() {
    if (!this.form.dependencia.trim()) {
      this.toast("info", "La dependencia (sede) es obligatoria");
      return;
    }
    const req =
      this.panel === "editar"
        ? this.loc.actualizar({ _id: this.editId, ...this.form })
        : this.loc.crear(this.form);
    req.subscribe({
      next: () => {
        this.toast("success", this.panel === "editar" ? "Actualizada" : "Creada");
        this.cancelar();
        this.cargar();
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo guardar"),
    });
  }

  eliminar(row: any) {
    Swal.fire({
      title: `¿Inactivar ${row.dependencia}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí",
      cancelButtonText: "Cancelar",
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.loc.eliminar(row._id).subscribe({
        next: () => {
          this.toast("success", "Inactivada");
          this.cargar();
        },
        error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo inactivar"),
      });
    });
  }

  onArchivo(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = "";
    if (!archivo) return;
    this.importando = true;
    this.loc.importarArchivo(archivo).subscribe({
      next: (res) => {
        this.importando = false;
        const b = res.body || {};
        this.toast(
          "success",
          `Importadas: ${b.creados || 0} nuevas, ${b.actualizados || 0} actualizadas`
        );
        this.cargar();
      },
      error: (err) => {
        this.importando = false;
        this.toast("error", err?.error?.body?.message || "No se pudo importar");
      },
    });
  }

  importarPlantilla() {
    this.importando = true;
    this.loc.importarPlantilla().subscribe({
      next: (res) => {
        this.importando = false;
        const b = res.body || {};
        this.toast(
          "success",
          `Plantilla: ${b.creados || 0} nuevas, ${b.actualizados || 0} actualizadas`
        );
        this.cargar();
      },
      error: (err) => {
        this.importando = false;
        this.toast("error", err?.error?.body?.message || "No se pudo cargar la plantilla");
      },
    });
  }

  toast(icon: "success" | "error" | "info", title: string) {
    Swal.fire({ toast: true, position: "top", icon, title, showConfirmButton: false, timer: 2800 });
  }
}
