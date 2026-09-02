import { Component, AfterViewInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatPaginator } from "@angular/material/paginator";
import { MatSort } from "@angular/material/sort";
import { MatTableDataSource } from "@angular/material/table";
import { MaterialModule } from "../../material.module";
import { SeguridadService } from "../../services/seguridad/seguridad.service";
import Swal from "sweetalert2";

@Component({
  selector: "app-permisos",
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: "./permisos.component.html",
  styleUrl: "./permisos.component.css",
})
export class PermisosComponent implements AfterViewInit {
  displayedColumns = ["modulo", "codigo", "nombre", "acciones"];
  dataSource = new MatTableDataSource<any>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  addForm = { codigo: "", nombre: "", modulo: "" };
  editForm = { _id: "", codigo: "", nombre: "", modulo: "" };

  constructor(private seguridad: SeguridadService) {}

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.cargar();
  }

  cargar() {
    this.seguridad.getPermisos().subscribe({
      next: (res) => (this.dataSource.data = res.body || []),
      error: () => (this.dataSource.data = []),
    });
  }

  applyFilter(event: Event) {
    this.dataSource.filter = (event.target as HTMLInputElement).value.trim().toLowerCase();
  }

  toast(icon: "success" | "error" | "info", title: string) {
    Swal.fire({ toast: true, position: "top", icon, title, showConfirmButton: false, timer: 2500 });
  }

  onSubmit() {
    this.seguridad.postPermiso(this.addForm).subscribe({
      next: () => {
        this.addForm = { codigo: "", nombre: "", modulo: "" };
        (document.querySelector('[data-bs-dismiss="offcanvas"]') as HTMLElement)?.click();
        this.toast("success", "Permiso creado");
        this.cargar();
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo guardar"),
    });
  }

  onClickDato(row: any) {
    this.editForm = {
      _id: row._id,
      codigo: row.codigo,
      nombre: row.nombre,
      modulo: row.modulo,
    };
  }

  onUpdate() {
    this.seguridad.putPermiso(this.editForm).subscribe({
      next: () => {
        (document.querySelector("[data-bs-dismiss-edit='true']") as HTMLElement)?.click();
        this.toast("success", "Permiso actualizado");
        this.cargar();
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo actualizar"),
    });
  }

  onDelete(_id: string) {
    Swal.fire({
      title: "¿Eliminar permiso?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.seguridad.deletePermiso(_id).subscribe({
        next: () => {
          this.toast("success", "Permiso eliminado");
          this.cargar();
        },
        error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo eliminar"),
      });
    });
  }
}
