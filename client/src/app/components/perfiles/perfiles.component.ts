import { Component, AfterViewInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatPaginator } from "@angular/material/paginator";
import { MatSort } from "@angular/material/sort";
import { MatTableDataSource } from "@angular/material/table";
import { MaterialModule } from "../../material.module";
import { SeguridadService } from "../../services/seguridad/seguridad.service";
import Swal from "sweetalert2";

type FormPerfil = {
  _id?: string;
  nombre: string;
  descripcion: string;
  permisos: string[];
};

@Component({
  selector: "app-perfiles",
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: "./perfiles.component.html",
  styleUrl: "./perfiles.component.css",
})
export class PerfilesComponent implements AfterViewInit {
  displayedColumns = ["nombre", "descripcion", "permisos", "acciones"];
  dataSource = new MatTableDataSource<any>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  catalogo: any[] = [];
  grupos: { modulo: string; items: any[] }[] = [];
  addForm: FormPerfil = { nombre: "", descripcion: "", permisos: [] };
  editForm: FormPerfil = { _id: "", nombre: "", descripcion: "", permisos: [] };

  constructor(private seguridad: SeguridadService) {}

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.cargarCatalogo();
    this.cargar();
  }

  cargarCatalogo() {
    this.seguridad.getPermisos().subscribe({
      next: (res) => {
        this.catalogo = res.body || [];
        const mapa = new Map<string, any[]>();
        for (const item of this.catalogo) {
          const lista = mapa.get(item.modulo) || [];
          lista.push(item);
          mapa.set(item.modulo, lista);
        }
        this.grupos = Array.from(mapa.entries()).map(([modulo, items]) => ({
          modulo,
          items,
        }));
      },
      error: () => {
        this.catalogo = [];
        this.grupos = [];
      },
    });
  }

  cargar() {
    this.seguridad.getPerfiles().subscribe({
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

  tiene(form: FormPerfil, codigo: string) {
    return form.permisos.includes(codigo);
  }

  toggle(form: FormPerfil, codigo: string) {
    const idx = form.permisos.indexOf(codigo);
    if (idx >= 0) {
      form.permisos = form.permisos.filter((item) => item !== codigo);
    } else {
      form.permisos = [...form.permisos, codigo];
    }
  }

  moduloCompleto(form: FormPerfil, items: any[]) {
    return items.length > 0 && items.every((item) => form.permisos.includes(item.codigo));
  }

  toggleModulo(form: FormPerfil, items: any[]) {
    if (this.moduloCompleto(form, items)) {
      const quitar = new Set(items.map((item) => item.codigo));
      form.permisos = form.permisos.filter((codigo) => !quitar.has(codigo));
      return;
    }
    const actuales = new Set(form.permisos);
    for (const item of items) actuales.add(item.codigo);
    form.permisos = Array.from(actuales);
  }

  onSubmit() {
    this.seguridad.postPerfil(this.addForm).subscribe({
      next: () => {
        this.addForm = { nombre: "", descripcion: "", permisos: [] };
        (document.querySelector('[data-bs-dismiss="offcanvas"]') as HTMLElement)?.click();
        this.toast("success", "Perfil creado");
        this.cargar();
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo guardar"),
    });
  }

  onClickDato(row: any) {
    this.editForm = {
      _id: row._id,
      nombre: row.nombre,
      descripcion: row.descripcion || "",
      permisos: [...(row.permisos || [])],
    };
  }

  onUpdate() {
    this.seguridad.putPerfil(this.editForm).subscribe({
      next: () => {
        (document.querySelector("[data-bs-dismiss-edit='true']") as HTMLElement)?.click();
        this.toast("success", "Perfil actualizado");
        this.cargar();
      },
      error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo actualizar"),
    });
  }

  onDelete(_id: string) {
    Swal.fire({
      title: "¿Eliminar perfil?",
      text: "No se puede si hay usuarios asociados.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.seguridad.deletePerfil(_id).subscribe({
        next: () => {
          this.toast("success", "Perfil eliminado");
          this.cargar();
        },
        error: (err) => this.toast("error", err?.error?.body?.message || "No se pudo eliminar"),
      });
    });
  }
}
