import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MaterialModule } from "../../material.module";
import { VehiculosService } from "../../services/vehiculos/vehiculos.service";
import Swal from "sweetalert2";

const formularioVacio = () => ({
  placa: "",
  conductor: "",
  telefono: "",
  capacidad: null as number | null,
  flete: 0 as number | null,
  idConductor: "",
  celularPtoContacto: "",
  transportadora: "",
  password: "",
});

@Component({
  selector: "app-vehiculos",
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: "./vehiculos.component.html",
  styleUrls: ["../despacho/despacho-page.css", "./vehiculos.component.css"],
})
export class VehiculosComponent implements OnInit {
  filas: any[] = [];
  cargando = true;
  detalleOculto = false;
  filtros = { conductor: "", placa: "" };
  panel: "nuevo" | "editar" | "" = "";
  form = formularioVacio();
  editId = "";
  guardando = false;
  tienePassword = false;

  constructor(private vehiculos: VehiculosService) {}

  ngOnInit() {
    this.cargar();
  }

  get visibles() {
    const conductor = this.filtros.conductor.trim().toLowerCase();
    const placa = this.filtros.placa.trim().toLowerCase();
    return this.filas.filter((row) => {
      if (conductor && !String(row.conductor || "").toLowerCase().includes(conductor)) return false;
      if (placa && !String(row.placa || "").toLowerCase().includes(placa)) return false;
      return true;
    });
  }

  cargar() {
    this.cargando = true;
    this.vehiculos.Get().subscribe({
      next: (res) => {
        this.filas = res.body || [];
        this.cargando = false;
      },
      error: (err) => {
        this.filas = [];
        this.cargando = false;
        this.aviso("error", this.mensajeError(err));
      },
    });
  }

  abrirNuevo() {
    this.editId = "";
    this.form = formularioVacio();
    this.tienePassword = false;
    this.panel = "nuevo";
  }

  abrirEditar(row: any) {
    this.editId = row._id;
    this.form = {
      placa: row.placa || "",
      conductor: row.conductor || "",
      telefono: row.telefono || "",
      capacidad: row.capacidad ?? null,
      flete: row.flete ?? 0,
      idConductor: row.idConductor || "",
      celularPtoContacto: row.celularPtoContacto || "",
      transportadora: row.transportadora || "",
      password: "",
    };
    this.panel = "editar";
    this.tienePassword = Boolean(row.tienePassword);
  }

  cancelar() {
    this.panel = "";
    this.editId = "";
    this.form = formularioVacio();
  }

  guardar() {
    if (!this.form.placa.trim() || this.guardando) return;
    this.guardando = true;
    const req = this.panel === "editar"
      ? this.vehiculos.Put({ _id: this.editId, ...this.form })
      : this.vehiculos.Post(this.form);
    const eraEdicion = this.panel === "editar";
    req.subscribe({
      next: () => {
        this.guardando = false;
        this.cancelar();
        this.aviso("success", eraEdicion ? "Vehículo actualizado." : "Vehículo registrado.");
        this.cargar();
      },
      error: (err) => {
        this.guardando = false;
        this.aviso("error", this.mensajeError(err));
      },
    });
  }

  eliminar(row: any) {
    Swal.fire({
      title: "¿Eliminar este vehículo?",
      text: "Dejará de aparecer al crear hojas de ruta.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      cancelButtonText: "Cancelar",
      confirmButtonText: "Sí, eliminar",
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.vehiculos.Delete(row._id).subscribe({
        next: () => {
          this.aviso("success", "Vehículo eliminado.");
          if (this.editId === row._id) this.cancelar();
          this.cargar();
        },
        error: (err) => this.aviso("error", this.mensajeError(err)),
      });
    });
  }

  pendiente(accion: string) {
    this.aviso("info", `${accion}: pendiente.`);
  }

  private mensajeError(error: any) {
    return (
      error?.error?.body?.message ||
      (error?.status === 0 ? "No hay conexión con el servidor." : "No se pudo completar la acción.")
    );
  }

  private aviso(icon: "success" | "error" | "info", title: string) {
    Swal.fire({ toast: true, position: "top", icon, title, showConfirmButton: false, timer: 3000 });
  }
}
