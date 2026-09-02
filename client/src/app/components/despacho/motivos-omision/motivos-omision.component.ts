import { AfterViewInit, Component, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatPaginator } from "@angular/material/paginator";
import { MatTableDataSource } from "@angular/material/table";
import { MatSort } from "@angular/material/sort";
import Swal from "sweetalert2";
import { MaterialModule } from "../../../material.module";
import { MotivosOmisionService } from "../../../services/despacho/motivos-omision.service";

@Component({
  selector: "app-motivos-omision",
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: "./motivos-omision.component.html",
  styleUrl: "../despacho-page.css",
})
export class MotivosOmisionComponent implements OnInit, AfterViewInit {
  displayedColumns = ["idMotivo", "nombre", "acciones"];
  dataSource = new MatTableDataSource<any>([]);
  addForm = { nombre: "" };
  editForm = { _id: "", nombre: "" };

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(private motivos: MotivosOmisionService) {}

  ngOnInit(): void {
    this.dataSource.filterPredicate = (row, filtro) => {
      const texto = `${row.idMotivo || ""} ${row.nombre || ""}`.toLowerCase();
      return texto.includes(filtro);
    };
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.OnGet();
  }

  OnGet() {
    this.motivos.Get().subscribe({
      next: (response) => {
        this.dataSource.data = response.body || [];
      },
      error: (error) => {
        this.dataSource.data = [];
        this.aviso(error.status === 404 ? "info" : "error", this.mensajeError(error));
      },
    });
  }

  applyFilter(event: Event) {
    this.dataSource.filter = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.paginator?.firstPage();
  }

  onSubmit() {
    this.motivos.Post(this.addForm).subscribe({
      next: () => {
        this.cerrarCanvas("[data-bs-dismiss='offcanvas']");
        this.addForm = { nombre: "" };
        this.aviso("success", "Motivo registrado.");
        this.OnGet();
      },
      error: (error) => this.aviso("error", this.mensajeError(error)),
    });
  }

  onClickDato(element: any) {
    this.editForm = {
      _id: element._id,
      nombre: element.nombre,
    };
  }

  onUpdate() {
    this.motivos.Put(this.editForm).subscribe({
      next: () => {
        this.cerrarCanvas("[data-bs-dismiss-edit='true']");
        this.editForm = { _id: "", nombre: "" };
        this.aviso("success", "Motivo actualizado.");
        this.OnGet();
      },
      error: (error) => this.aviso("error", this.mensajeError(error)),
    });
  }

  onDelete(_id: string) {
    Swal.fire({
      title: "¿Eliminar este motivo?",
      text: "Dejará de aparecer al omitir un producto en el despacho.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      cancelButtonText: "Cancelar",
      confirmButtonText: "Sí, eliminar",
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.motivos.Delete(_id).subscribe({
        next: () => {
          this.aviso("success", "Motivo eliminado.");
          this.OnGet();
        },
        error: (error) => this.aviso("error", this.mensajeError(error)),
      });
    });
  }

  private cerrarCanvas(selector: string) {
    const closeCanvas = document.querySelector(selector) as HTMLElement | null;
    closeCanvas?.click();
  }

  private mensajeError(error: any) {
    return (
      error?.error?.body?.message ||
      (error?.status === 0 ? "No hay conexión con el servidor." : "No se pudo completar la acción.")
    );
  }

  private aviso(icon: "success" | "error" | "info", title: string) {
    Swal.fire({
      toast: true,
      position: "top",
      icon,
      title,
      showConfirmButton: false,
      timer: 3000,
    });
  }
}
