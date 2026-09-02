import { Component, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatPaginator } from "@angular/material/paginator";
import { MatTableDataSource } from "@angular/material/table";
import { MatSort } from "@angular/material/sort";
import Swal from "sweetalert2";
import { MaterialModule } from "../../material.module";
import { MuellesService } from "../../services/muelles/muelles.service";
import { BodegasService } from "../../services/bodegas/bodegas.service";

@Component({
  selector: "app-muelles",
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: "./muelles.component.html",
})
export class MuellesComponent implements OnInit {
  displayedColumns = ["nombre", "bodega", "acciones"];
  dataSource = new MatTableDataSource<any>([]);
  bodegas: any[] = [];
  addForm = { nombre: "", bodega: "" };
  editForm = { _id: "", nombre: "", bodega: "" };

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private muelles: MuellesService,
    private bodegasService: BodegasService
  ) {}

  ngOnInit(): void {
    this.dataSource.filterPredicate = (row, filtro) => {
      const bodega = row.bodega || {};
      const texto = `${row.nombre || ""} ${bodega.codigo || ""} ${bodega.nombre || ""}`.toLowerCase();
      return texto.includes(filtro);
    };
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.OnGet();
    this.cargarBodegas();
  }

  OnGet() {
    this.muelles.Get().subscribe({
      next: (res) => {
        this.dataSource.data = res.body || [];
      },
      error: () => {
        this.dataSource.data = [];
      },
    });
  }

  cargarBodegas() {
    this.bodegasService.Get().subscribe({
      next: (res) => {
        this.bodegas = res.body || [];
      },
      error: () => {
        this.bodegas = [];
      },
    });
  }

  applyFilter(event: Event) {
    this.dataSource.filter = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.paginator?.firstPage();
  }

  onSubmit() {
    this.muelles.Post(this.addForm).subscribe({
      next: () => {
        this.cerrarCanvas("[data-bs-dismiss='offcanvas']");
        this.addForm = { nombre: "", bodega: "" };
        this.aviso("success", "Muelle registrado.");
        this.OnGet();
      },
      error: (error) => this.aviso("error", this.mensajeError(error)),
    });
  }

  onClickDato(element: any) {
    this.editForm = {
      _id: element._id,
      nombre: element.nombre,
      bodega: element.bodega?._id || element.bodega,
    };
    this.cargarBodegas();
  }

  onUpdate() {
    this.muelles.Put(this.editForm).subscribe({
      next: () => {
        this.cerrarCanvas("[data-bs-dismiss-edit='true']");
        this.editForm = { _id: "", nombre: "", bodega: "" };
        this.aviso("success", "Muelle actualizado.");
        this.OnGet();
      },
      error: (error) => this.aviso("error", this.mensajeError(error)),
    });
  }

  onDelete(_id: string) {
    Swal.fire({
      title: "¿Eliminar este muelle?",
      text: "Solo si no tiene báscula asociada.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      cancelButtonText: "Cancelar",
      confirmButtonText: "Sí, eliminar",
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.muelles.Delete(_id).subscribe({
        next: () => {
          this.aviso("success", "Muelle eliminado.");
          this.OnGet();
        },
        error: (error) => this.aviso("error", this.mensajeError(error)),
      });
    });
  }

  etiquetaBodega(row: any) {
    const bodega = row?.bodega;
    if (!bodega || typeof bodega === "string") return bodega || "—";
    return [bodega.codigo, bodega.nombre].filter(Boolean).join(" - ") || "—";
  }

  private cerrarCanvas(selector: string) {
    (document.querySelector(selector) as HTMLElement | null)?.click();
  }

  private mensajeError(error: any) {
    return error?.error?.body?.message || "No se pudo completar la acción.";
  }

  private aviso(icon: "success" | "error" | "info", title: string) {
    Swal.fire({ toast: true, position: "top", icon, title, showConfirmButton: false, timer: 3000 });
  }
}
