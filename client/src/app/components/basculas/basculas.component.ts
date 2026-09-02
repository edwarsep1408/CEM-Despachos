import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatPaginator } from "@angular/material/paginator";
import { MatTableDataSource } from "@angular/material/table";
import { MatSort } from "@angular/material/sort";
import { Subscription } from "rxjs";
import Swal from "sweetalert2";
import { MaterialModule } from "../../material.module";
import { BasculasService } from "../../services/basculas/basculas.service";
import { BodegasService } from "../../services/bodegas/bodegas.service";
import { MuellesService } from "../../services/muelles/muelles.service";
import { SocketService } from "../../services/socket/socket.service";

@Component({
  selector: "app-basculas",
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: "./basculas.component.html",
  styleUrl: "./basculas.component.css",
})
export class BasculasComponent implements OnInit, OnDestroy {
  displayedColumns = ["nombre", "ip", "puerto", "bodega", "muelle", "acciones"];
  dataSource = new MatTableDataSource<any>([]);
  bodegas: any[] = [];
  addForm = { nombre: "", ip: "", puerto: 5001, bodega: "", muelle: "" };
  editForm = { _id: "", nombre: "", ip: "", puerto: 5001, bodega: "", muelle: "" };
  muelles: any[] = [];
  prueba: any = null;
  conectado = false;
  conectando = false;
  log: Array<{ ts: number; texto: string; hex: string; bytes: number; peso?: number | null; trama?: string }> = [];
  peso: number | null = null;
  comando = "";
  crlf = "crlf";
  private socketSubs: Subscription[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild("logPuerto") logPuerto?: ElementRef<HTMLPreElement>;

  constructor(
    private basculasService: BasculasService,
    private bodegasService: BodegasService,
    private muellesService: MuellesService,
    private socket: SocketService
  ) {}

  ngOnInit(): void {
    this.dataSource.filterPredicate = (row, filtro) => {
      const bodega = row.bodega || {};
      const muelle = row.muelle || {};
      const texto = `${row.nombre || ""} ${row.ip || ""} ${row.puerto || ""} ${muelle.nombre || ""} ${bodega.codigo || ""} ${bodega.nombre || ""}`.toLowerCase();
      return texto.includes(filtro);
    };
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.OnGet();
    this.cargarBodegas();
    this.cargarMuelles();
    document
      .getElementById("offcanvasBasculaPrueba")
      ?.addEventListener("hidden.bs.offcanvas", () => this.cerrarPrueba());
  }

  OnGet() {
    this.basculasService.Get().subscribe({
      next: (response) => {
        this.dataSource.data = response.body || [];
      },
      error: (error) => {
        this.dataSource.data = [];
        this.aviso(error.status === 404 ? "info" : "error", this.mensajeError(error));
      },
    });
  }

  cargarBodegas() {
    this.bodegasService.Get().subscribe({
      next: (response) => {
        this.bodegas = response.body || [];
      },
      error: () => {
        this.bodegas = [];
      },
    });
  }

  cargarMuelles() {
    this.muellesService.Get().subscribe({
      next: (response) => {
        this.muelles = response.body || [];
      },
      error: () => {
        this.muelles = [];
      },
    });
  }

  applyFilter(event: Event) {
    this.dataSource.filter = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.paginator?.firstPage();
  }

  onSubmit() {
    this.basculasService.Post(this.addForm).subscribe({
      next: () => {
        this.cerrarCanvas("[data-bs-dismiss='offcanvas']");
        this.addForm = { nombre: "", ip: "", puerto: 5001, bodega: "", muelle: "" };
        this.aviso("success", "Báscula registrada.");
        this.OnGet();
      },
      error: (error) => this.aviso("error", this.mensajeError(error)),
    });
  }

  onClickDato(element: any) {
    this.editForm = {
      _id: element._id,
      nombre: element.nombre,
      ip: element.ip,
      puerto: Number(element.puerto) || 5001,
      bodega: element.bodega?._id || element.bodega,
      muelle: element.muelle?._id || element.muelle || "",
    };
    this.cargarBodegas();
    this.cargarMuelles();
  }

  onUpdate() {
    this.basculasService.Put(this.editForm).subscribe({
      next: () => {
        this.cerrarCanvas("[data-bs-dismiss-edit='true']");
        this.editForm = { _id: "", nombre: "", ip: "", puerto: 5001, bodega: "", muelle: "" };
        this.aviso("success", "Báscula actualizada.");
        this.OnGet();
      },
      error: (error) => this.aviso("error", this.mensajeError(error)),
    });
  }

  onDelete(_id: string) {
    Swal.fire({
      title: "¿Eliminar esta báscula?",
      text: "Dejará de estar disponible para captura de peso.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      cancelButtonText: "Cancelar",
      confirmButtonText: "Sí, eliminar",
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.basculasService.Delete(_id).subscribe({
        next: () => {
          this.aviso("success", "Báscula eliminada.");
          this.OnGet();
        },
        error: (error) => this.aviso("error", this.mensajeError(error)),
      });
    });
  }

  etiquetaBodega(row: any) {
    const bodega = row?.bodega;
    if (!bodega) return "—";
    if (typeof bodega === "string") return bodega;
    const codigo = String(bodega.codigo || "").trim();
    const nombre = String(bodega.nombre || "").trim();
    return [codigo, nombre].filter(Boolean).join(" - ") || "—";
  }

  etiquetaMuelle(row: any) {
    const muelle = row?.muelle;
    if (!muelle) return "—";
    if (typeof muelle === "string") return muelle;
    return String(muelle.nombre || "").trim() || "—";
  }

  muellesDe(bodegaId: string): any[] {
    if (!bodegaId) return [];
    return this.muelles.filter((item) => String(item.bodega?._id || item.bodega) === String(bodegaId));
  }

  alCambiarBodega(form: { bodega: string; muelle: string }) {
    const opciones = this.muellesDe(form.bodega);
    if (!opciones.some((item) => String(item._id) === String(form.muelle))) {
      form.muelle = opciones[0]?._id || "";
    }
  }

  abrirPrueba(row: any) {
    this.cerrarSocketsPrueba();
    this.prueba = row;
    this.log = [];
    this.peso = null;
    this.conectado = false;
    this.conectando = false;
    this.comando = "";
    this.socket.emitSocket("bascula-subscribe", { id: row._id });
    this.socketSubs = [
      this.socket.eventBasculaDato().subscribe((msg: any) => {
        if (msg?.id !== this.prueba?._id) return;
        this.log = [...this.log.slice(-299), msg];
        if (typeof msg?.peso === "number" && Number.isFinite(msg.peso)) this.peso = msg.peso;
        setTimeout(() => this.scrollLog(), 0);
      }),
      this.socket.eventBasculaEstado().subscribe((msg: any) => {
        if (msg?.id !== this.prueba?._id) return;
        this.conectado = Boolean(msg?.conectado);
        this.conectando = false;
        if (msg?.error) this.aviso("error", msg.error);
      }),
    ];
  }

  escuchar() {
    if (!this.prueba?._id || this.conectando) return;
    this.conectando = true;
    this.basculasService.Escuchar(this.prueba._id).subscribe({
      next: (response: any) => {
        this.conectando = false;
        this.conectado = true;
        this.aviso("success", response.body?.message || "Escuchando el puerto.");
      },
      error: (error) => {
        this.conectando = false;
        this.conectado = false;
        this.aviso("error", this.mensajeError(error));
      },
    });
  }

  detenerEscucha() {
    if (!this.prueba?._id) return;
    this.basculasService.Detener(this.prueba._id).subscribe({
      next: () => {
        this.conectado = false;
        this.conectando = false;
      },
      error: (error) => this.aviso("error", this.mensajeError(error)),
    });
  }

  enviarComando() {
    if (!this.prueba?._id || !this.conectado) return;
    this.basculasService
      .Enviar(this.prueba._id, { texto: this.comando, crlf: this.crlf })
      .subscribe({
        next: () => {
          this.log = [
            ...this.log.slice(-299),
            {
              ts: Date.now(),
              texto: `>> ${this.comando || "(vacío)"}`,
              hex: "TX",
              bytes: 0,
            },
          ];
          setTimeout(() => this.scrollLog(), 0);
        },
        error: (error) => this.aviso("error", this.mensajeError(error)),
      });
  }

  limpiarLog() {
    this.log = [];
    this.peso = null;
  }

  cerrarPrueba() {
    if (this.prueba?._id) {
      this.basculasService.Detener(this.prueba._id).subscribe({ error: () => {} });
      this.socket.emitSocket("bascula-unsubscribe", { id: this.prueba._id });
    }
    this.cerrarSocketsPrueba();
    this.prueba = null;
    this.conectado = false;
    this.conectando = false;
  }

  ngOnDestroy(): void {
    this.cerrarPrueba();
  }

  private cerrarSocketsPrueba() {
    this.socketSubs.forEach((sub) => sub.unsubscribe());
    this.socketSubs = [];
  }

  private scrollLog() {
    const el = this.logPuerto?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
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
