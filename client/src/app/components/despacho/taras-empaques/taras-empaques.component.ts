import { AfterViewInit, Component, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatPaginator } from "@angular/material/paginator";
import { MatTableDataSource } from "@angular/material/table";
import { MatSort } from "@angular/material/sort";
import Swal from "sweetalert2";
import { MaterialModule } from "../../../material.module";
import { TarasEmpaquesService } from "../../../services/despacho/taras-empaques.service";

const formularioVacio = () => ({
  nombre: "",
  unidad: "UNIDAD",
  peso: null as number | null,
  empaque: "N/A",
  esCaja: false,
  activo: true,
});

@Component({
  selector: "app-taras-empaques",
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: "./taras-empaques.component.html",
  styleUrl: "../despacho-page.css",
})
export class TarasEmpaquesComponent implements OnInit, AfterViewInit {
  displayedColumns = ["idTara", "nombre", "unidad", "activo", "peso", "empaque", "esCaja", "acciones"];
  dataSource = new MatTableDataSource<any>([]);
  unidades = ["UNIDAD", "KILOS"];
  empaques = ["N/A", "CANASTA", "CAJA REFRIGERADA", "CAJA CONGELADA", "CANASTA IFCO"];
  addForm = formularioVacio();
  editForm = { _id: "", ...formularioVacio() };

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(private taras: TarasEmpaquesService) {}

  ngOnInit(): void {
    this.dataSource.filterPredicate = (row, filtro) => {
      const texto = `${row.idTara || ""} ${row.nombre || ""} ${row.unidad || ""} ${row.empaque || ""} ${row.peso || ""}`.toLowerCase();
      return texto.includes(filtro);
    };
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.OnGet();
  }

  OnGet() {
    this.taras.Get().subscribe({
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
    this.taras.Post(this.addForm).subscribe({
      next: () => {
        this.cerrarCanvas("[data-bs-dismiss='offcanvas']");
        this.addForm = formularioVacio();
        this.aviso("success", "Tara registrada.");
        this.OnGet();
      },
      error: (error) => this.aviso("error", this.mensajeError(error)),
    });
  }

  onClickDato(element: any) {
    this.editForm = {
      _id: element._id,
      nombre: element.nombre,
      unidad: element.unidad || "UNIDAD",
      peso: element.peso ?? element.pesoKg,
      empaque: element.empaque || "N/A",
      esCaja: Boolean(element.esCaja),
      activo: element.activo !== false,
    };
  }

  onUpdate() {
    this.taras.Put(this.editForm).subscribe({
      next: () => {
        this.cerrarCanvas("[data-bs-dismiss-edit='true']");
        this.editForm = { _id: "", ...formularioVacio() };
        this.aviso("success", "Tara actualizada.");
        this.OnGet();
      },
      error: (error) => this.aviso("error", this.mensajeError(error)),
    });
  }

  onDelete(_id: string) {
    Swal.fire({
      title: "¿Eliminar esta tara?",
      text: "Dejará de estar disponible al restar empaque en el despacho.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      cancelButtonText: "Cancelar",
      confirmButtonText: "Sí, eliminar",
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.taras.Delete(_id).subscribe({
        next: () => {
          this.aviso("success", "Tara eliminada.");
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
