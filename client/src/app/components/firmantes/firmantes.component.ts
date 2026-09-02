import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatPaginator } from "@angular/material/paginator";
import { MatTableDataSource } from "@angular/material/table";
import { MatSort } from "@angular/material/sort";
import Swal from "sweetalert2";
import { MaterialModule } from "../../material.module";
import { FirmantesService } from "../../services/despacho/firmantes.service";

const CARGOS = [
  { codigo: "AUXILIAR_CALIDAD", etiqueta: "AUXILIAR DE CALIDAD" },
  { codigo: "SUPERVISOR_LOGISTICA", etiqueta: "SUPERVISOR DE LOGISTICA" },
];

@Component({
  selector: "app-firmantes",
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: "./firmantes.component.html",
  styleUrls: ["../despacho/despacho-page.css", "./firmantes.component.css"],
})
export class FirmantesComponent implements OnInit, AfterViewInit {
  cargos = CARGOS;
  displayedColumns = ["idFirmante", "nombre", "cargo", "firma", "acciones"];
  dataSource = new MatTableDataSource<any>([]);
  addForm = { nombre: "", cargo: "AUXILIAR_CALIDAD", firma: "" };
  editForm = { _id: "", nombre: "", cargo: "AUXILIAR_CALIDAD", firma: "" };
  private padSucioAdd = false;
  private padSucioEdit = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild("padAdd") padAdd?: ElementRef<HTMLCanvasElement>;
  @ViewChild("padEdit") padEdit?: ElementRef<HTMLCanvasElement>;

  constructor(private firmantes: FirmantesService) {}

  ngOnInit(): void {
    this.dataSource.filterPredicate = (row, filtro) => {
      const texto = `${row.idFirmante || ""} ${row.nombre || ""} ${row.cargoEtiqueta || row.cargo || ""}`.toLowerCase();
      return texto.includes(filtro);
    };
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.OnGet();
    this.prepararPad(this.padAdd?.nativeElement);
    this.prepararPad(this.padEdit?.nativeElement);
  }

  OnGet() {
    this.firmantes.listar().subscribe({
      next: (response) => {
        this.dataSource.data = (response.body || []).filter((item: any) => item.origen !== "usuario");
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

  etiquetaCargo(codigo: string) {
    return CARGOS.find((item) => item.codigo === codigo)?.etiqueta || codigo;
  }

  onSubmit() {
    const firma = this.capturar(this.padAdd?.nativeElement, this.addForm.firma, this.padSucioAdd);
    if (!firma) {
      this.aviso("error", "Dibuje o cargue la firma.");
      return;
    }
    this.firmantes.crear({ ...this.addForm, firma }).subscribe({
      next: () => {
        this.cerrarCanvas("[data-bs-dismiss='offcanvas']");
        this.addForm = { nombre: "", cargo: "AUXILIAR_CALIDAD", firma: "" };
        this.limpiarPad(this.padAdd?.nativeElement);
        this.padSucioAdd = false;
        this.aviso("success", "Firmante registrado.");
        this.OnGet();
      },
      error: (error) => this.aviso("error", this.mensajeError(error)),
    });
  }

  onClickDato(element: any) {
    this.editForm = {
      _id: element._id,
      nombre: element.nombre,
      cargo: element.cargo,
      firma: element.firma || "",
    };
    this.padSucioEdit = false;
    setTimeout(() => this.pintarFirma(this.padEdit?.nativeElement, this.editForm.firma), 50);
  }

  onUpdate() {
    const firma = this.capturar(this.padEdit?.nativeElement, this.editForm.firma, this.padSucioEdit);
    this.firmantes.actualizar({ ...this.editForm, firma }).subscribe({
      next: () => {
        this.cerrarCanvas("[data-bs-dismiss-edit='true']");
        this.editForm = { _id: "", nombre: "", cargo: "AUXILIAR_CALIDAD", firma: "" };
        this.aviso("success", "Firmante actualizado.");
        this.OnGet();
      },
      error: (error) => this.aviso("error", this.mensajeError(error)),
    });
  }

  onDelete(_id: string) {
    Swal.fire({
      title: "¿Eliminar este firmante?",
      text: "Las hojas ya creadas conservan la firma que tenían.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      cancelButtonText: "Cancelar",
      confirmButtonText: "Sí, eliminar",
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.firmantes.eliminar(_id).subscribe({
        next: () => {
          this.aviso("success", "Firmante eliminado.");
          this.OnGet();
        },
        error: (error) => this.aviso("error", this.mensajeError(error)),
      });
    });
  }

  private dibujando: Record<"add" | "edit", boolean> = { add: false, edit: false };

  dibujar(ev: PointerEvent, cual: "add" | "edit") {
    if (!this.dibujando[cual]) return;
    const canvas = cual === "add" ? this.padAdd?.nativeElement : this.padEdit?.nativeElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = this.punto(ev, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (cual === "add") this.padSucioAdd = true;
    else this.padSucioEdit = true;
  }

  empezar(ev: PointerEvent, cual: "add" | "edit") {
    ev.preventDefault();
    const canvas = cual === "add" ? this.padAdd?.nativeElement : this.padEdit?.nativeElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(ev.pointerId);
    this.dibujando[cual] = true;
    const { x, y } = this.punto(ev, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  terminar(_ev: PointerEvent, cual: "add" | "edit") {
    this.dibujando[cual] = false;
    const canvas = cual === "add" ? this.padAdd?.nativeElement : this.padEdit?.nativeElement;
    canvas?.getContext("2d")?.beginPath();
  }

  private punto(ev: PointerEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left) / rect.width) * canvas.width,
      y: ((ev.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  borrarPad(cual: "add" | "edit") {
    if (cual === "add") {
      this.limpiarPad(this.padAdd?.nativeElement);
      this.addForm.firma = "";
      this.padSucioAdd = false;
    } else {
      this.limpiarPad(this.padEdit?.nativeElement);
      this.editForm.firma = "";
      this.padSucioEdit = false;
    }
  }

  cargarArchivo(event: Event, cual: "add" | "edit") {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      this.aviso("error", "Use una imagen PNG o JPG.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || "");
      this.reducirImagen(data, (firma) => {
        if (cual === "add") {
          this.addForm.firma = firma;
          this.padSucioAdd = false;
          this.pintarFirma(this.padAdd?.nativeElement, firma);
        } else {
          this.editForm.firma = firma;
          this.padSucioEdit = false;
          this.pintarFirma(this.padEdit?.nativeElement, firma);
        }
      });
    };
    reader.readAsDataURL(file);
    (event.target as HTMLInputElement).value = "";
  }

  private prepararPad(canvas?: HTMLCanvasElement) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    this.limpiarPad(canvas);
  }

  private limpiarPad(canvas?: HTMLCanvasElement) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
  }

  private pintarFirma(canvas?: HTMLCanvasElement, firma?: string) {
    if (!canvas) return;
    this.limpiarPad(canvas);
    if (!firma) return;
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const escala = Math.min(canvas.width / img.width, canvas.height / img.height);
      const w = img.width * escala;
      const h = img.height * escala;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    };
    img.src = firma;
  }

  private capturar(canvas: HTMLCanvasElement | undefined, previa: string, sucio: boolean) {
    if (sucio && canvas) return canvas.toDataURL("image/png");
    return previa || "";
  }

  private reducirImagen(data: string, ok: (firma: string) => void) {
    const img = new Image();
    img.onload = () => {
      const max = 420;
      const escala = Math.min(1, max / img.width, 160 / img.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * escala));
      canvas.height = Math.max(1, Math.round(img.height * escala));
      const ctx = canvas.getContext("2d");
      if (!ctx) return ok(data);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ok(canvas.toDataURL("image/png"));
    };
    img.src = data;
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
