import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MaterialModule } from "../../../material.module";
import { CodigosEanService } from "../../../services/despacho/codigos-ean.service";
import Swal from "sweetalert2";

const vacio = () => ({
  ean: "",
  cliente: "todos",
  localizacion: "1",
  referencia: "",
  descripcion: "",
});

@Component({
  selector: "app-codigos-ean",
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: "./codigos-ean.component.html",
  styleUrls: ["../despacho-page.css", "../cargues/cargues.component.css"],
})
export class CodigosEanComponent implements OnInit {
  filas: any[] = [];
  cargando = true;
  importando = false;
  detalleOculto = false;
  filtros = { ean: "", cliente: "", referencia: "" };
  panel: "nuevo" | "editar" | "" = "";
  form = vacio();
  editId = "";

  constructor(private ean: CodigosEanService) {}

  ngOnInit() {
    this.cargar();
  }

  get visibles() {
    const ean = this.filtros.ean.trim().toLowerCase();
    const cliente = this.filtros.cliente.trim().toLowerCase();
    const referencia = this.filtros.referencia.trim().toLowerCase();
    return this.filas.filter((row) => {
      if (ean && !String(row.ean || "").toLowerCase().includes(ean)) return false;
      if (cliente && !String(row.cliente || "").toLowerCase().includes(cliente)) return false;
      if (referencia && !String(row.referencia || "").toLowerCase().includes(referencia)) return false;
      return true;
    });
  }

  cargar() {
    this.cargando = true;
    this.ean.Get().subscribe({
      next: (res) => {
        this.filas = res.body || [];
        this.cargando = false;
      },
      error: (err) => {
        this.filas = [];
        this.cargando = false;
        this.toast("error", err?.error?.body?.message || "No se pudieron leer los códigos EAN");
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
      ean: row.ean || "",
      cliente: row.cliente || "todos",
      localizacion: row.localizacion || "1",
      referencia: row.referencia || "",
      descripcion: row.descripcion || "",
    };
    this.panel = "editar";
  }

  cancelar() {
    this.panel = "";
    this.editId = "";
    this.form = vacio();
  }

  guardar() {
    if (!this.form.ean.trim() || !this.form.referencia.trim()) {
      this.toast("info", "EAN y referencia son obligatorios");
      return;
    }
    const req =
      this.panel === "editar"
        ? this.ean.Put({ _id: this.editId, ...this.form })
        : this.ean.Post(this.form);
    req.subscribe({
      next: () => {
        this.toast("success", this.panel === "editar" ? "Actualizado" : "Registrado");
        this.cancelar();
        this.cargar();
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo guardar"),
    });
  }

  eliminar(row: any) {
    Swal.fire({
      title: "¿Eliminar este EAN?",
      text: `${row.ean} → ${row.referencia}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.ean.Delete(row._id).subscribe({
        next: () => {
          this.toast("success", "Eliminado");
          this.cargar();
        },
        error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo eliminar"),
      });
    });
  }

  onCsv(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = "";
    this.importando = true;
    this.ean.importarCsv(archivo || undefined).subscribe({
      next: (res) => {
        this.importando = false;
        const b = res.body || {};
        this.toast("success", `CSV: ${b.creados || 0} nuevos, ${b.actualizados || 0} actualizados`);
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
    this.ean.importarCsv().subscribe({
      next: (res) => {
        this.importando = false;
        const b = res.body || {};
        this.toast("success", `Cargados ${b.total || 0} (nuevos ${b.creados || 0})`);
        this.cargar();
      },
      error: (err) => {
        this.importando = false;
        this.toast("error", err?.error?.body?.message || "No se pudo cargar la plantilla");
      },
    });
  }

  pendiente(accion: string) {
    this.toast("info", `${accion}: pendiente`);
  }

  private toast(icon: "success" | "error" | "info", title: string) {
    Swal.fire({ toast: true, position: "top", icon, title, showConfirmButton: false, timer: 3200 });
  }
}
