import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, interval, Subscription } from 'rxjs';
import { filter, startWith, switchMap, take, timeout } from 'rxjs/operators';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MaterialModule } from '../../../material.module';
import { PedidosService } from '../../../services/despacho/pedidos.service';
import { etiquetaPedido } from '../../../core/etiqueta-docto';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';

export interface PedidoFila {
  idEnc: string;
  tipoDocto?: string;
  nit: string;
  sucursal: string;
  sucursalDescripcion?: string;
  cliente: string;
  estado: string;
  idCargue?: number | null;
  barrio: string;
  municipio: string;
  direccion: string;
  telefono: string;
  observacion: string;
  codigo: string;
  fecha: string;
  hora: string;
  valor: string | number;
  cp: string | number;
  enRuta: string | number;
  bodega: string;
  barrioPed: string;
  direccionPed: string;
  vendedor?: string;
  contacto?: string;
  establecimiento?: string;
  co?: string;
  fechaEntrega?: string;
}

interface LineaPedido {
  codigo: string;
  producto: string;
  cant: string | number;
  unidad: string;
  vUnit: string | number;
  valor: string | number;
  vlrBruto: string | number;
  cant2: string | number;
  kilo: string | number;
  unidades: string | number;
  idDetenc: string;
  notas: string;
  bodega: string;
  motivo: string;
  motivoDesc: string;
  listaPrecio: string;
  co: string;
  unNegocio: string;
  fechaEntrega: string;
  estado: string;
  canastas: string | number;
  bultos: string | number;
  cajas: string | number;
}

interface PedidoDetalle extends PedidoFila {
  lineas: LineaPedido[];
}

type VistaPedidos = 'estandar' | 'impresion';

const RANGO_KEY = 'cem.pedidos.rango.v3';

const fechaIso = (value: unknown) => {
  const s = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

const rangoGuardado = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(RANGO_KEY) || '');
    const desde = fechaIso(raw?.desde);
    const hasta = fechaIso(raw?.hasta);
    if (desde && hasta) return { desde, hasta };
  } catch {
    /* ignore */
  }
  return { desde: '2025-12-26', hasta: '2025-12-31' };
};

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './pedidos.component.html',
  styleUrls: ['../despacho-page.css', './pedidos.component.css'],
})
export class PedidosComponent implements OnInit, AfterViewInit, OnDestroy {
  cargando = false;
  sincronizando = false;
  private syncPoll: Subscription | null = null;
  private syncVioEnCurso = false;
  consulta = '';
  total = 0;
  ultimaSincronizacion: any = null;
  vista: VistaPedidos = 'estandar';
  seleccion = new Set<string>();
  picking: PedidoDetalle | null = null;
  cargandoPicking = false;
  detalleModo: 'comercial' | 'picking' = 'comercial';
  lineaPagina = 0;
  lineasPorPagina = 20;
  etiquetaPedido = etiquetaPedido;
  private fechasTimer: ReturnType<typeof setTimeout> | null = null;

  filtros = {
    ...rangoGuardado(),
    vendedor: '',
    cliente: '',
    pedido: '',
    tipoDocto: '',
    bodega: '',
    estado: '',
    razonSocial: '',
    barrio: '',
    municipio: '',
    sucursal: '',
    nit: '',
    barrioPed: '',
  };

  columnasEstandar: string[] = [
    'acciones',
    'idEnc',
    'fecha',
    'sucursalDescripcion',
    'cliente',
    'estado',
    'idCargue',
    'barrio',
    'municipio',
    'direccion',
    'telefono',
    'observacion',
    'codigo',
    'valor',
    'bodega',
  ];

  columnasImpresion: string[] = [
    'sel',
    'acciones',
    'idEnc',
    'nit',
    'sucursal',
    'cliente',
    'estado',
    'idCargue',
    'barrio',
    'municipio',
    'direccion',
    'telefono',
    'observacion',
    'codigo',
    'fecha',
    'hora',
    'valor',
    'cp',
    'enRuta',
    'bodega',
    'barrioPed',
    'direccionPed',
  ];

  dataSource = new MatTableDataSource<PedidoFila>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(private pedidosService: PedidosService) {}

  get displayedColumns(): string[] {
    return this.vista === 'estandar' ? this.columnasEstandar : this.columnasImpresion;
  }

  get filtrados(): PedidoFila[] {
    return this.dataSource.filteredData?.length
      ? this.dataSource.filteredData
      : this.dataSource.data;
  }

  get totalValor(): number {
    return this.filtrados.reduce((sum, row) => sum + Number(row.valor || 0), 0);
  }

  get totalDetalle(): number {
    return (this.picking?.lineas || []).reduce(
      (sum, linea) => sum + Number(linea.valor || 0),
      0
    );
  }

  get lineasPagina(): LineaPedido[] {
    const lineas = this.picking?.lineas || [];
    const desde = this.lineaPagina * this.lineasPorPagina;
    return lineas.slice(desde, desde + this.lineasPorPagina);
  }

  get totalPaginasLineas(): number {
    const n = this.picking?.lineas?.length || 0;
    return Math.max(1, Math.ceil(n / this.lineasPorPagina));
  }

  get bodegas(): string[] {
    return this.unicos((row) => row.bodega);
  }

  get vendedores(): string[] {
    return this.unicos((row) => row.codigo || row.vendedor || '');
  }

  get tiposDocto(): string[] {
    return this.unicos((row) => row.tipoDocto || '');
  }

  get estados(): string[] {
    return this.unicos((row) => String(row.estado || ''));
  }

  ngOnInit(): void {
    this.dataSource.filterPredicate = (row, raw) => this.cumpleFiltros(row, raw);
    this.cargar();
    this.cargarUltimaSincronizacion();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  ngOnDestroy() {
    if (this.fechasTimer) clearTimeout(this.fechasTimer);
    this.syncPoll?.unsubscribe();
  }

  get rangoTexto() {
    const desde = fechaIso(this.filtros.desde);
    const hasta = fechaIso(this.filtros.hasta);
    if (!desde || !hasta) return '';
    return `${desde} a ${hasta}`;
  }

  private rangoListo() {
    let desde = fechaIso(this.filtros.desde);
    let hasta = fechaIso(this.filtros.hasta);
    if (!desde || !hasta) return null;
    if (desde > hasta) {
      const tmp = desde;
      desde = hasta;
      hasta = tmp;
      this.filtros.desde = desde;
      this.filtros.hasta = hasta;
    }
    return { desde, hasta };
  }

  cambiarVista(vista: VistaPedidos) {
    this.vista = vista;
    this.cerrarPicking();
    this.seleccion.clear();
  }

  aplicarFiltros() {
    this.dataSource.filter = JSON.stringify(this.filtros);
    this.seleccion.clear();
  }

  cambiarFechas() {
    if (this.fechasTimer) clearTimeout(this.fechasTimer);
    this.fechasTimer = setTimeout(() => this.cargar(), 350);
  }

  cargar() {
    const rango = this.rangoListo();
    if (!rango) return;
    localStorage.setItem(RANGO_KEY, JSON.stringify(rango));
    this.cargando = true;
    this.pedidosService.getPedidos(rango).subscribe({
      next: (response) => {
        this.consulta = response.consulta || '';
        this.total = response.total || 0;
        this.dataSource.data = response.body || [];
        this.aplicarFiltros();
        this.cargando = false;
        setTimeout(() => {
          if (this.paginator) this.dataSource.paginator = this.paginator;
          if (this.sort) this.dataSource.sort = this.sort;
        });
      },
      error: (error) => {
        this.cargando = false;
        this.dataSource.data = [];
        this.total = 0;
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'error',
          title:
            error?.error?.body?.message ||
            'No se pudieron leer los pedidos locales.',
          showConfirmButton: false,
          timer: 4000,
        });
      },
    });
  }

  async sincronizar() {
    const rango = this.rangoListo();
    if (!rango) {
      Swal.fire({
        icon: 'warning',
        title: 'Elija un rango de fechas',
        text: 'Desde y hasta son obligatorios para filtrar y sincronizar.',
        confirmButtonText: 'Ok',
      });
      return;
    }
    const ok = await Swal.fire({
      icon: 'question',
      title: '¿Sincronizar SIESA?',
      text: `Se guardarán los pedidos con fecha de documento del ${rango.desde} al ${rango.hasta}.`,
      showCancelButton: true,
      confirmButtonText: 'Sincronizar',
      cancelButtonText: 'Cancelar',
    });
    if (!ok.isConfirmed) return;
    const usuario = localStorage.getItem('user') || 'admin';
    this.sincronizando = true;
    this.syncVioEnCurso = false;
    Swal.fire({
      title: 'Sincronizando SIESA',
      html: `Pedidos del ${rango.desde} al ${rango.hasta}. Puede tardar varios minutos.<br><small>Use un rango corto (unos días). Un mes entero satura Connekta.</small>`,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'Cancelar importación',
      allowOutsideClick: false,
      allowEscapeKey: true,
      didOpen: () => {
        Swal.showLoading();
        const cancel = Swal.getCancelButton();
        if (cancel) {
          cancel.style.display = 'inline-block';
          cancel.disabled = false;
        }
      },
    }).then((result) => {
      if (
        result.dismiss === Swal.DismissReason.cancel ||
        result.dismiss === Swal.DismissReason.esc
      ) {
        this.cancelarSincronizacion();
      }
    });
    this.pedidosService.sincronizar(usuario, rango.desde, rango.hasta).subscribe({
      next: () => this.esperarFinSync(rango),
      error: () => this.esperarFinSync(rango),
    });
  }

  private cancelarSincronizacion() {
    this.syncPoll?.unsubscribe();
    this.syncPoll = null;
    this.sincronizando = false;
    const usuario = localStorage.getItem('user') || 'admin';
    this.pedidosService.cancelar(usuario).subscribe({
      next: () => this.avisoCancelada(),
      error: () => this.avisoCancelada(),
    });
  }

  private avisoCancelada() {
    this.cargar();
    this.cargarUltimaSincronizacion();
    Swal.fire({
      icon: 'info',
      title: 'Importación cancelada',
      text: 'No se guardó el lote. Use un rango más corto, por ejemplo unos días, no un mes entero.',
      confirmButtonText: 'Ok',
    });
  }

  private esperarFinSync(rango: { desde: string; hasta: string }) {
    this.syncPoll?.unsubscribe();
    this.syncPoll = interval(3000)
      .pipe(
        startWith(0),
        switchMap(() => this.pedidosService.ultimaSincronizacion()),
        filter((response) => {
          const body = response?.body || {};
          if (body.enCurso) {
            this.syncVioEnCurso = true;
            return false;
          }
          if (body.syncOk || body.syncError) return true;
          return this.syncVioEnCurso;
        }),
        take(1),
        timeout({ first: 30 * 60 * 1000 })
      )
      .subscribe({
        next: (response) => {
          this.sincronizando = false;
          this.syncPoll = null;
          const body = response?.body || {};
          this.cargar();
          this.cargarUltimaSincronizacion();
          if (body.syncError || !body.syncOk) {
            const cancelada = /cancelad/i.test(String(body.syncError || ''));
            Swal.fire({
              icon: cancelada || !body.syncError ? 'info' : 'error',
              title: cancelada || !body.syncError ? 'Importación cancelada' : 'No se sincronizó',
              text:
                body.syncError ||
                'El servidor detuvo la sincronización. Use un rango más corto.',
              confirmButtonText: 'Ok',
            });
            return;
          }
          const resultado = body.syncResultado || {};
          Swal.fire({
            toast: !resultado.aviso,
            position: 'top',
            icon: resultado.aviso ? 'warning' : 'success',
            title: `${resultado.totalPedidos || resultado.nuevos || 0} pedidos · ${
              resultado.desde || rango.desde
            } a ${resultado.hasta || rango.hasta}`,
            text: resultado.aviso || undefined,
            showConfirmButton: Boolean(resultado.aviso),
            timer: resultado.aviso ? undefined : 5000,
          });
        },
        error: () => {
          this.sincronizando = false;
          this.syncPoll = null;
          this.cargar();
          this.cargarUltimaSincronizacion();
          Swal.fire({
            icon: 'info',
            title: 'Sincronización en curso',
            text: 'El servidor sigue guardando. Recargue Pedidos en un par de minutos.',
            confirmButtonText: 'Ok',
          });
        },
      });
  }

  cargarUltimaSincronizacion() {
    this.pedidosService.ultimaSincronizacion().subscribe({
      next: (response) => {
        this.ultimaSincronizacion = response.body;
      },
      error: () => {
        this.ultimaSincronizacion = null;
      },
    });
  }

  toggleSel(idEnc: string, checked: boolean) {
    if (checked) this.seleccion.add(idEnc);
    else this.seleccion.delete(idEnc);
  }

  estaSel(idEnc: string) {
    return this.seleccion.has(idEnc);
  }

  seleccionarTodos() {
    this.filtrados.forEach((row) => this.seleccion.add(row.idEnc));
  }

  seleccionarNinguno() {
    this.seleccion.clear();
  }

  ver(row: PedidoFila) {
    this.lineaPagina = 0;
    this.detalleModo = this.vista === 'impresion' ? 'picking' : 'comercial';
    this.abrirDetalle(row);
  }

  editar(_row: PedidoFila) {
    Swal.fire({
      toast: true,
      position: 'top',
      icon: 'info',
      title: 'La edición del pedido se define en el siguiente paso.',
      showConfirmButton: false,
      timer: 3000,
    });
  }

  imprimirMarcados() {
    const filas = this.filtrados.filter((row) => this.seleccion.has(row.idEnc));
    if (!filas.length) {
      Swal.fire({
        toast: true,
        position: 'top',
        icon: 'info',
        title: 'Marca al menos un pedido.',
        showConfirmButton: false,
        timer: 2500,
      });
      return;
    }
    this.imprimirPickingFilas(filas);
  }

  imprimirTodos() {
    if (!this.filtrados.length) return;
    this.imprimirPickingFilas(this.filtrados);
  }

  exportarExcel() {
    const cols =
      this.vista === 'estandar'
        ? [
            'pedido',
            'sucursalDescripcion',
            'cliente',
            'estado',
            'idCargue',
            'barrio',
            'municipio',
            'direccion',
            'telefono',
            'observacion',
            'codigo',
            'fecha',
            'valor',
            'bodega',
          ]
        : [
            'pedido',
            'nit',
            'sucursal',
            'cliente',
            'estado',
            'idCargue',
            'barrio',
            'municipio',
            'direccion',
            'telefono',
            'observacion',
            'codigo',
            'fecha',
            'hora',
            'valor',
            'cp',
            'enRuta',
            'bodega',
            'barrioPed',
            'direccionPed',
          ];
    const header = cols.join(';');
    const lines = this.filtrados.map((row: any) =>
      cols
        .map((col) => {
          const valor = col === 'pedido' ? etiquetaPedido(row) : row[col];
          return `"${String(valor ?? '').replace(/"/g, '""')}"`;
        })
        .join(';')
    );
    const blob = new Blob(['\ufeff' + [header, ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    saveAs(blob, `pedidos-${this.vista}.csv`);
  }

  cerrarPicking() {
    this.picking = null;
    this.cargandoPicking = false;
    this.lineaPagina = 0;
  }

  imprimirPicking() {
    if (!this.picking) return;
    if (this.detalleModo === 'comercial') {
      this.imprimirHojas([this.picking], 'comercial');
      return;
    }
    this.imprimirHojas([this.picking], 'picking');
  }

  exportarLineas() {
    if (!this.picking) return;
    const header = 'CODIGO;PRODUCTO;UND;V_UNIT;VALOR;KG';
    const lines = this.picking.lineas.map((linea) =>
      [linea.codigo, linea.producto, linea.unidades, linea.vUnit, linea.valor, linea.kilo]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(';')
    );
    const blob = new Blob(['\ufeff' + [header, ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    saveAs(blob, `pedido-${this.picking.idEnc}.csv`);
  }

  nitDe(pedido: PedidoFila | PedidoDetalle | null) {
    if (!pedido) return '';
    const nit = String(pedido.nit || '').split('-')[0].trim();
    const suc = String(pedido.sucursal || '').trim();
    if (!nit) return '';
    return suc ? `${nit}-${suc}` : nit;
  }

  fechaDe(pedido: PedidoFila | PedidoDetalle | null) {
    return String(pedido?.fecha || '').slice(0, 10);
  }

  vendedorDe(pedido: PedidoFila | PedidoDetalle | null) {
    const descripcion = String(pedido?.vendedor || '').trim();
    const codigo = String(pedido?.codigo || '').trim();
    if (descripcion && !/^VC\d+$/i.test(descripcion)) return descripcion;
    return descripcion || codigo || '—';
  }

  horaDe(pedido: PedidoFila | PedidoDetalle | null) {
    const hora = String(pedido?.hora || '').trim();
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(hora)) return hora.length === 5 ? `${hora}:00` : hora;
    const iso = (String(pedido?.fecha || '').match(/T(\d{2}:\d{2}:\d{2})/) || [])[1];
    return iso && iso !== '00:00:00' ? iso : hora;
  }

  private abrirDetalle(fila: PedidoFila) {
    this.cargandoPicking = true;
    this.picking = null;
    this.pedidosService.getPedido(fila.idEnc).subscribe({
      next: (response) => {
        this.picking = this.aDetalle(fila, response.body);
        this.cargandoPicking = false;
      },
      error: () => {
        this.cargandoPicking = false;
        this.picking = this.aDetalle(fila, fila);
      },
    });
  }

  private async imprimirPickingFilas(filas: PedidoFila[]) {
    if (filas.length > 80) {
      const ok = await Swal.fire({
        icon: 'warning',
        title: `Vas a imprimir ${filas.length} pedidos`,
        text: 'Filtra la lista o marca un lote más chico para el picking.',
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar',
      });
      if (!ok.isConfirmed) return;
    }
    this.cargandoPicking = true;
    try {
      const detalles = await this.cargarDetalles(filas);
      this.cargandoPicking = false;
      this.imprimirHojas(detalles, 'picking');
    } catch {
      this.cargandoPicking = false;
      Swal.fire({
        icon: 'error',
        title: 'No se pudieron cargar los pedidos para imprimir.',
        confirmButtonText: 'Ok',
      });
    }
  }

  private cargarDetalles(filas: PedidoFila[]): Promise<PedidoDetalle[]> {
    return Promise.all(
      filas.map((fila) =>
        firstValueFrom(this.pedidosService.getPedido(fila.idEnc))
          .then((response) => this.aDetalle(fila, response.body))
          .catch(() => this.aDetalle(fila, fila))
      )
    );
  }

  private aDetalle(fila: PedidoFila, pedido: any): PedidoDetalle {
    const lineas = this.lineasDe(pedido, fila);
    const valorLineas = lineas.reduce((sum, linea) => sum + Number(linea.valor || 0), 0);
    return {
      ...fila,
      tipoDocto: pedido?.tipoDocto || fila.tipoDocto || '',
      vendedor: pedido?.vendedor || pedido?.codigo || fila.vendedor || fila.codigo || '',
      codigo: pedido?.codigo || fila.codigo || '',
      contacto: pedido?.contacto || fila.contacto || pedido?.sucursalDescripcion || fila.sucursalDescripcion || '',
      direccion: pedido?.direccion || fila.direccion,
      nit: pedido?.nit || fila.nit,
      sucursal: pedido?.sucursal || fila.sucursal,
      sucursalDescripcion: pedido?.sucursalDescripcion || fila.sucursalDescripcion || fila.sucursal,
      cliente: pedido?.cliente || fila.cliente,
      establecimiento: pedido?.establecimiento || fila.establecimiento || pedido?.cliente || fila.cliente,
      estado: pedido?.estado || fila.estado,
      barrio: pedido?.barrio || fila.barrio,
      municipio: pedido?.municipio || fila.municipio,
      telefono: pedido?.telefono || fila.telefono,
      observacion: pedido?.observacion || fila.observacion,
      bodega: (() => {
        const co = String(pedido?.co || lineas[0]?.co || fila.co || '').trim();
        const codigo = String(
          pedido?.bodega || lineas[0]?.bodega || fila.bodega || ''
        ).trim();
        return codigo && codigo !== co ? codigo : '';
      })(),
      co: pedido?.co || lineas[0]?.co || fila.co,
      fecha: pedido?.fecha || fila.fecha,
      hora: pedido?.hora || fila.hora,
      valor: valorLineas || pedido?.valor || fila.valor,
      direccionPed: pedido?.direccionPed || fila.direccionPed || pedido?.direccion || fila.direccion,
      barrioPed: pedido?.barrioPed || fila.barrioPed || pedido?.barrio || fila.barrio,
      lineas,
    };
  }

  private lineasDe(pedido: any, fila: PedidoFila): LineaPedido[] {
    const siesa = Array.isArray(pedido?.siesa) ? pedido.siesa : [];
    const deSiesa = siesa
      .map((row: any) => this.mapLinea(row))
      .filter((linea: LineaPedido) => this.lineaConProducto(linea));
    if (deSiesa.length) return deSiesa;
    const propias = Array.isArray(pedido?.lineas) ? pedido.lineas : [];
    return propias
      .map((row: any) => this.mapLinea(row))
      .filter((linea: LineaPedido) => this.lineaConProducto(linea));
  }

  private lineaConProducto(linea: LineaPedido) {
    return Boolean(linea.codigo || linea.producto || linea.cant);
  }

  private mapLinea(row: any): LineaPedido {
    const unidad = this.pick(row, ['id_unidad_medida', 'UM', 'unidad', 'UND']).trim();
    const kilos = this.pick(row, ['kilo', 'KILO', 'cant1_pedida', 'CantidadKilos']);
    const unidades = this.pick(row, ['unidades', 'Unidades', 'cant2_pedida']);
    const um = unidad.toUpperCase();
    const cantUnd = um === 'UND' ? unidades || kilos : unidades || kilos;
    const cantKg = um === 'UND' ? kilos || unidades : kilos || unidades;
    const cant = cantUnd || kilos;
    const valor = this.pick(row, ['vlr_neto', 'VALOR', 'valor']);
    const cantN = Number(String(cant).replace(',', '.'));
    const valorN = Number(String(valor).replace(',', '.'));
    let vUnit = this.pick(row, ['V_UNIT', 'v_unit', 'vUnit', 'precio_unitario', 'precio']);
    if (!vUnit && cantN) vUnit = String(Number((valorN / cantN).toFixed(4)));
    return {
      codigo: this.pick(row, [
        'item referencia',
        'item_referencia',
        'Referencia',
        'referencia',
        'id_item',
        'codigo',
      ]).trim(),
      producto: this.pick(row, [
        'item descripcion',
        'item_descripcion',
        'PRODUCTO',
        'producto',
        'descripcion',
      ]).trim(),
      cant,
      unidad,
      vUnit,
      valor,
      vlrBruto: this.pick(row, ['vlr_bruto']),
      cant2: cantKg,
      kilo: cantKg,
      unidades: cantUnd,
      idDetenc: this.pick(row, [
        'ID_DETENC',
        'idDetenc',
        'LineaRegistro',
        'id_ext1_detalle',
        'id_detenc',
      ]),
      notas: this.pick(row, ['notas_linea', 'notas']),
      bodega: (() => {
        const co = String(
          this.pick(row, ['id_co_movto', 'COPedido', 'Id_co', 'co']) || ''
        ).trim();
        const codigo = String(
          this.pick(row, ['Id_bodega', 'id_bodega', 'BODEGA']) || ''
        ).trim();
        return codigo && codigo !== co ? codigo : '';
      })(),
      co: this.pick(row, ['id_co_movto', 'COPedido', 'Id_co', 'co']),
      motivo: this.pick(row, ['id_motivo', 'Motivo']),
      motivoDesc: this.pick(row, ['DescripcionMotivo', 'desc_motivo']),
      listaPrecio: this.pick(row, ['id_lista_precio', 'ListaPrecio']),
      unNegocio: this.pick(row, ['Id_un_movto', 'id_un_movto']),
      fechaEntrega: this.pick(row, ['Fecha_entrega', 'fecha_entrega']).slice(0, 10),
      estado: this.etiquetaEstado(row),
      canastas: '',
      bultos: '',
      cajas: '',
    };
  }

  private etiquetaEstado(row: any): string {
    const crudo = this.pick(row, [
      'Ind_estado_pv',
      'f430_ind_estado',
      'estado',
    ]);
    if (!crudo) return '';
    if (/[A-Za-z]/.test(crudo) && !/^\d+$/.test(crudo)) {
      if (crudo === 'ANUL' || crudo === 'PARCIAL') return 'Aprobado';
      if (crudo === 'ELAB') return 'Elaborado';
      if (crudo === 'APROB') return 'Retenido';
      if (crudo === 'CUMPL') return 'Cumplido';
      return crudo;
    }
    const estados: Record<string, string> = {
      '0': 'Elaborado',
      '1': 'Retenido',
      '2': 'Aprobado',
      '3': 'Anulado',
      '4': 'Cumplido',
    };
    return estados[crudo] || crudo;
  }

  private pick(row: any, keys: string[]): string {
    if (!row) return '';
    const entries = Object.entries(row);
    const norm = (name: string) => name.toLowerCase().replace(/[\s_]/g, '');
    for (const key of keys) {
      const found = entries.find(([name]) => norm(name) === norm(key));
      if (!found) continue;
      const value = found[1];
      if (value === undefined || value === null) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return '';
  }

  private imprimirHojas(detalles: PedidoDetalle[], modo: 'comercial' | 'picking') {
    const logo = `${window.location.origin}/assets/img/LOGOTIPO.svg`;
    const hojas = detalles
      .map((pedido, index) =>
        modo === 'comercial'
          ? this.htmlHojaComercial(pedido, logo)
          : this.htmlHojaPicking(pedido, logo, index + 1, detalles.length)
      )
      .join('');
    const ventana = window.open('', '_blank', 'width=900,height=700');
    if (!ventana) {
      Swal.fire({
        toast: true,
        position: 'top',
        icon: 'error',
        title: 'El navegador bloqueó la ventana de impresión.',
        showConfirmButton: false,
        timer: 4000,
      });
      return;
    }
    const titulo = modo === 'comercial' ? 'Pedido Default' : 'Impresion de Pedido';
    ventana.document.write(`<!doctype html><html><head><title>${titulo}</title>
      <style>
        @page{size:A4;margin:12mm}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:16px}
        .hoja{page-break-after:always;position:relative;padding-bottom:28px;min-height:240mm}
        .hoja:last-child{page-break-after:auto}
        .logo{position:absolute;top:0;right:0;width:150px}
        h1{margin:0 0 10px;font-size:22px;font-weight:700}
        .meta{font-size:13px;line-height:1.45;max-width:72%}
        .meta b{display:inline-block;min-width:150px}
        table{width:100%;border-collapse:collapse;margin-top:14px;font-size:12px}
        th,td{border:1px solid #1d4f91;padding:5px 6px;text-align:left;vertical-align:top}
        th{background:#8ec3e6;color:#113}
        .dash{text-align:center}
        .footer{margin-top:10px;font-size:13px}
        .pie{position:absolute;bottom:0;left:0;right:0;font-size:11px;color:#444;display:flex;justify-content:space-between}
      </style></head><body>${hojas}</body></html>`);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => ventana.print(), 400);
  }

  private htmlHojaComercial(pedido: PedidoDetalle, logo: string) {
    const filas = pedido.lineas
      .map(
        (linea) => `<tr>
          <td>${this.esc(linea.codigo)}</td>
          <td>${this.esc(linea.producto)}</td>
          <td>${this.esc(linea.unidades)}</td>
          <td>${this.esc(linea.vUnit)}</td>
          <td>${this.fmt(linea.valor)}</td>
          <td>${this.esc(linea.kilo)}</td>
        </tr>`
      )
      .join('');
    const total = pedido.lineas.reduce((sum, linea) => sum + Number(linea.valor || 0), 0);
    return `<section class="hoja">
      <img class="logo" src="${logo}" alt="CEM" />
      <h1>Pedido Default</h1>
      <div class="meta">
        <div><b>Pedido No:</b> ${this.esc(etiquetaPedido(pedido))}</div>
        <div><b>Fecha:</b> ${this.esc(this.fechaDe(pedido))}</div>
        <div><b>Cliente:</b> ${this.esc(pedido.cliente)}</div>
        <div><b>Contacto:</b> ${this.esc(pedido.contacto || pedido.sucursalDescripcion || pedido.cliente)}</div>
        <div><b>nit:</b> ${this.esc(this.nitDe(pedido))}</div>
        <div><b>Vendedor:</b> ${this.esc(pedido.vendedor || pedido.codigo)}</div>
        <div><b>Observación:</b> ${this.esc(pedido.observacion)}</div>
      </div>
      <table>
        <thead><tr>
          <th>CODIGO</th><th>PRODUCTO</th><th>UND</th><th>V_UNIT</th>
          <th>VALOR</th><th>KG</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="footer"><b>Total (valor):</b> ${this.fmt(total)}</div>
      <div class="footer">Página 1 de 1 · Total Registros: ${pedido.lineas.length}</div>
    </section>`;
  }

  private htmlHojaPicking(
    pedido: PedidoDetalle,
    logo: string,
    pagina: number,
    totalPaginas: number
  ) {
    const filas = pedido.lineas
      .map(
        (linea) => `<tr>
          <td>${this.esc(linea.codigo)}</td>
          <td>${this.esc(linea.producto)}</td>
          <td>${this.esc(linea.unidades)}</td>
          <td>${this.esc(linea.kilo)}</td>
          <td class="dash">----</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>`
      )
      .join('');
    const year = new Date().getFullYear();
    return `<section class="hoja">
      <img class="logo" src="${logo}" alt="CEM" />
      <h1>Pedido</h1>
      <div class="meta">
        <div><b>NUMERO:</b> ${this.esc(etiquetaPedido(pedido))}</div>
        <div><b>VENDEDOR:</b> ${this.esc(this.vendedorDe(pedido))}</div>
        <div><b>NIT:</b> ${this.esc(this.nitDe(pedido))}</div>
        <div><b>CLIENTE:</b> ${this.esc(pedido.cliente)}</div>
        <div><b>CONTACTO:</b> ${this.esc(pedido.contacto || pedido.sucursalDescripcion)}</div>
        <div><b>ESTABLECIMIENTO:</b> ${this.esc(pedido.establecimiento || pedido.cliente)}</div>
        <div><b>DIRECCION:</b> ${this.esc(pedido.direccion)}</div>
        <div><b>FECHA:</b> ${this.esc(this.fechaDe(pedido))}</div>
        <div><b>HORA:</b> ${this.esc(this.horaDe(pedido))}</div>
        <div><b>DIRECCION_PED:</b> ${this.esc(pedido.direccionPed)}</div>
        <div><b>BARRIO_PED:</b> ${this.esc(pedido.barrioPed)}</div>
        <div><b>OBSERVACION:</b> ${this.esc(pedido.observacion)}</div>
      </div>
      <table>
        <thead><tr>
          <th>CODIGO</th><th>REFERENCIA</th><th>UND</th><th>KG</th><th></th>
          <th>KG BRUTO</th><th>KG NETO</th><th>UNIDADES</th>
          <th>CANASTAS</th><th>BULTOS</th><th>CAJAS</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="footer"><b>Total Registros:</b> ${pedido.lineas.length}</div>
      <div class="pie">
        <span>${pagina}/${totalPaginas} PDF generado usando CEM</span>
        <span>Introsoftware ${year}</span>
      </div>
    </section>`;
  }

  private fmt(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n) || !value) return String(value ?? '');
    return n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private esc(value: unknown) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private unicos(fn: (row: PedidoFila) => string) {
    return [...new Set(this.dataSource.data.map(fn).filter(Boolean))].sort();
  }

  private cumpleFiltros(row: PedidoFila, raw: string) {
    if (!raw) return true;
    let f = this.filtros;
    try {
      f = JSON.parse(raw);
    } catch {
      return true;
    }
    const fecha = String(row.fecha || '').slice(0, 10);
    if (f.desde || f.hasta) {
      if (!fecha) return false;
      if (f.desde && fecha < f.desde) return false;
      if (f.hasta && fecha > f.hasta) return false;
    }
    const contiene = (valor: unknown, q: string) =>
      !q || String(valor || '').toLowerCase().includes(q.trim().toLowerCase());
    if (f.vendedor && row.codigo !== f.vendedor && row.vendedor !== f.vendedor) return false;
    if (f.tipoDocto && row.tipoDocto !== f.tipoDocto) return false;
    if (f.bodega && row.bodega !== f.bodega) return false;
    if (f.estado && String(row.estado) !== f.estado) return false;
    return (
      contiene(row.cliente, f.cliente) &&
      (contiene(row.idEnc, f.pedido) || contiene(etiquetaPedido(row), f.pedido)) &&
      contiene(row.cliente, f.razonSocial) &&
      contiene(row.barrio, f.barrio) &&
      contiene(row.municipio, f.municipio) &&
      contiene(row.sucursalDescripcion || row.sucursal, f.sucursal) &&
      contiene(row.nit, f.nit) &&
      contiene(row.barrioPed, f.barrioPed)
    );
  }
}
