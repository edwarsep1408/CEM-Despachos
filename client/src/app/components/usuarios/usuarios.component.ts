import { Component, AfterViewInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatPaginator } from "@angular/material/paginator";
import { MatSort } from "@angular/material/sort";
import { MatTableDataSource } from "@angular/material/table";
import { MaterialModule } from "../../material.module";
import { SeguridadService } from "../../services/seguridad/seguridad.service";
import { CARGOS_USUARIO, esCargoFirma, etiquetaCargo } from "../../core/cargos-usuario";
import Swal from "sweetalert2";

@Component({
  selector: "app-usuarios",
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: "./usuarios.component.html",
  styleUrl: "./usuarios.component.css",
})
export class UsuariosComponent implements AfterViewInit {
  displayedColumns = ["usuario", "nombre", "cargo", "firma", "perfil", "estado", "acciones"];
  dataSource = new MatTableDataSource<any>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  perfiles: any[] = [];
  cargos = CARGOS_USUARIO;
  addForm = { usuario: "", nombre: "", password: "", cargo: "", perfil: "" };
  editForm = {
    _id: "",
    usuario: "",
    nombre: "",
    password: "",
    cargo: "",
    perfil: "",
    tieneFirma: false,
    borrarFirma: false,
  };

  constructor(private seguridad: SeguridadService) {}

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = (row, filtro) => {
      const texto = `${row.usuario || ""} ${row.nombre || ""} ${this.etiqueta(row.cargo)} ${this.estadoFirma(row)} ${row.perfil?.nombre || ""} ${row.activo === false ? "inactivo" : "activo"}`.toLowerCase();
      return texto.includes(filtro);
    };
    this.cargarPerfiles();
    this.cargar();
  }

  cargarPerfiles() {
    this.seguridad.getPerfiles().subscribe({
      next: (res) => (this.perfiles = res.body || []),
      error: () => (this.perfiles = []),
    });
  }

  cargar() {
    this.seguridad.getUsuarios().subscribe({
      next: (res) => (this.dataSource.data = res.body || []),
      error: () => (this.dataSource.data = []),
    });
  }

  nombrePerfil(row: any) {
    if (this.esFirma(row?.cargo)) return "Solo firma";
    return row?.perfil?.nombre || "—";
  }

  etiqueta(codigo: string) {
    return etiquetaCargo(codigo);
  }

  esFirma(codigo: string) {
    return esCargoFirma(codigo);
  }

  onCargoChange(form: { cargo: string; perfil: string }) {
    if (this.esFirma(form.cargo)) {
      form.perfil = "";
      return;
    }
    if (form.cargo === "DESPACHADOR" && !form.perfil) {
      const despachador = this.perfiles.find((perfil) => /despachador/i.test(perfil.nombre));
      if (despachador) form.perfil = despachador._id;
    }
  }

  detalleCargo(row: any) {
    return this.etiqueta(row.cargo);
  }

  estadoFirma(row: any) {
    if (!this.esFirma(row?.cargo)) return "No aplica";
    return row.tieneFirma || row.firma ? "Guardada" : "Sin guardar";
  }

  applyFilter(event: Event) {
    this.dataSource.filter = (event.target as HTMLInputElement).value.trim().toLowerCase();
  }

  toast(icon: "success" | "error" | "info", title: string) {
    Swal.fire({ toast: true, position: "top", icon, title, showConfirmButton: false, timer: 2500 });
  }

  onSubmit() {
    this.seguridad.postUsuario(this.addForm).subscribe({
      next: () => {
        this.addForm = { usuario: "", nombre: "", password: "", cargo: "", perfil: "" };
        (document.querySelector('[data-bs-dismiss="offcanvas"]') as HTMLElement)?.click();
        this.toast("success", "Usuario creado");
        this.cargar();
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo guardar"),
    });
  }

  onClickDato(row: any) {
    this.editForm = {
      _id: row._id,
      usuario: row.usuario,
      nombre: row.nombre,
      password: "",
      cargo: row.cargo || "",
      perfil: row.perfil?._id || row.perfil || "",
      tieneFirma: !!row.tieneFirma || !!row.firma,
      borrarFirma: false,
    };
  }

  onUpdate() {
    const payload = { ...this.editForm };
    if (!payload.password) {
      delete (payload as any).password;
    }
    this.seguridad.putUsuario(payload).subscribe({
      next: () => {
        (document.querySelector("[data-bs-dismiss-edit='true']") as HTMLElement)?.click();
        this.toast("success", "Usuario actualizado");
        this.cargar();
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo actualizar"),
    });
  }

  onInactivar(row: any) {
    Swal.fire({
      title: "¿Inactivar usuario?",
      text: "No se borra de la base de datos. Deja de entrar al sistema y se puede activar después.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, inactivar",
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.seguridad.putUsuarioEstado(row._id, false).subscribe({
        next: () => {
          this.toast("success", "Usuario inactivo");
          this.cargar();
        },
        error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo inactivar"),
      });
    });
  }

  onActivar(row: any) {
    this.seguridad.putUsuarioEstado(row._id, true).subscribe({
      next: () => {
        this.toast("success", "Usuario activo");
        this.cargar();
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo activar"),
    });
  }
}
