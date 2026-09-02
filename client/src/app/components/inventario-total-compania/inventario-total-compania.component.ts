import { Component, ViewChild, OnDestroy } from '@angular/core';
import { BodegasService } from '../../services/bodegas/bodegas.service';
import { MaterialModule } from '../../material.module';
import { CommonModule, DecimalPipe } from '@angular/common';
import ApexCharts from 'apexcharts';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { SesionService } from '../../services/sesion/sesion.service';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-inventario-total-compania',
  standalone: true,
  imports: [CommonModule, MaterialModule, MatPaginatorModule, MatTableModule, MatFormFieldModule, MatSortModule, MatTooltipModule, MatProgressBarModule, RouterModule],
  templateUrl: './inventario-total-compania.component.html',
  styleUrl: './inventario-total-compania.component.css',
})
export class InventarioTotalCompaniaComponent implements OnDestroy {

  labelsLinea: any;
  valuesLinea: any;
  labelsCombinacionCriterios: any;
  kgCombinacionCriterios: any;
  unidadesCombinacionCriterios: any;
  cargando: boolean = false;
  insumosenTransito: any = [];
  bodegasDisponibles: any;
  columnasDatatable: any = ['referencia', 'descripcion'];
  columnasTableLinea: any = ['descripcionLinea', 'peso', 'unidades', 'porcentajeParticipacion'];
  columnasTableLineaExpand = [...this.columnasTableLinea, 'expand'];
  expandedLineas = new Set<any>();
  totalKgs = 0;
  totalUnidades = 0;
  totalKgMovimento = 0;
  totalUnidadesMovimiento = 0;
  transitoCargando = false;
  private transitoIntentos = 0;
  token: string = ''
  detallesLineaSeleccionada: any = [];
  statusSession: boolean = false

  @ViewChild('paginator') paginator!: MatPaginator;
  @ViewChild('sort') sort!: MatSort;
  @ViewChild('paginatorLinea') paginatorLinea!: MatPaginator;
  @ViewChild('sortLinea') sortLinea!: MatSort;
  dataSource = new MatTableDataSource<any>();
  dataSourceLinea = new MatTableDataSource([]);
  private transitoTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private _bodegasService: BodegasService, private _router: Router, private _route: ActivatedRoute, private sessionService: SesionService) {



  }

  ngAfterViewInit() {

    setTimeout(() => {
      this.cargando = true;
      this.consultarInventarioCompania();
    });
  }


  consultarInventarioCompania() {

    this._bodegasService.consultarInventarioTotalCompania().subscribe({
      next: (response) => {
        if (response.body) {
          this.labelsLinea = response.body.labelsLinea;
          this.valuesLinea = response.body.valuesLinea;
          this.bodegasDisponibles = response.body.bodegasDisponibles || [];
          this.columnasDatatable = ['referencia', 'descripcion', 'rotacion', 'totalCompaniaPeso', 'totalCompaniaUnidades', 'promedioGeneral', ...this.bodegasDisponibles.map((bodega: any) => bodega.desc_bodega)]
          this.dataSource.data = response.body.informacionAgrupadaFront || [];
          const primeraAsigacion = (response.body.detallesLineaFront || []).map((val: any) => ({
            ...val,
            detalle: false
          }));
          this.dataSourceLinea.data = primeraAsigacion;
          this.insumosenTransito = response.body.documentosEnTrasporte;
          this.labelsCombinacionCriterios = response.body.labelCombCriterios;
          this.kgCombinacionCriterios = response.body.kgCombCriterios
          this.unidadesCombinacionCriterios = response.body.unidadesCombCriterios;
          this.totalKgs = response.body.totales.totalKgCompania;
          this.totalUnidades = response.body.totales.totalUnidadesCompania;
          this.aplicarTransito(response.body);

          setTimeout(() => {
            this.dataSource.sort = this.sort;
            this.dataSource.paginator = this.paginator;
            this.dataSourceLinea.paginator = this.paginatorLinea;
            this.dataSourceLinea.sort = this.sortLinea;
            this.onCreateChart();
            this.onCreateChartCombinacioncriterios();
          }, 0);
        }
        this.cargando = false;
      },
      error: (error) => {
        console.error(error);
        this.cargando = false;
        Swal.fire({
          title: 'No se pudo consultar el inventario',
          text:
            error?.error?.body?.message ||
            'SIESA Connekta no respondió el inventario de la compañía.',
          icon: 'error',
        });
      },
    });
  }

  ngOnInit(): void {

    setTimeout(() => this.reloadPage(), 200000)

  }

  ngOnDestroy(): void {
    if (this.transitoTimer) {
      clearTimeout(this.transitoTimer);
      this.transitoTimer = null;
    }
  }

  private aplicarTransito(body: any): void {
    const totales = body?.totales || {};
    if (totales.totalKgMovimiento != null) {
      this.totalKgMovimento = totales.totalKgMovimiento;
    }
    if (totales.totalUnidadesMovimiento != null) {
      this.totalUnidadesMovimiento = totales.totalUnidadesMovimiento;
    }
    if (Array.isArray(body?.documentosEnTrasporte)) {
      this.insumosenTransito = body.documentosEnTrasporte;
    }
    const transito = body?.transito || {};
    const sinDatos = !this.totalKgMovimento && !this.totalUnidadesMovimiento;
    this.transitoCargando = Boolean(transito.enCurso) && sinDatos;
    if (transito.enCurso) {
      this.programarRefrescoTransito();
    } else if (!transito.listo && sinDatos && this.transitoIntentos < 20) {
      this.programarRefrescoTransito();
    }
  }

  private programarRefrescoTransito(): void {
    if (this.transitoTimer) clearTimeout(this.transitoTimer);
    this.transitoIntentos += 1;
    this.transitoTimer = setTimeout(() => this.consultarTransito(), 8000);
  }

  private consultarTransito(): void {
    this._bodegasService.consultarInventarioTransito().subscribe({
      next: (response) => {
        if (response.body) this.aplicarTransito(response.body);
      },
      error: (error) => {
        console.error(error);
        this.transitoCargando = false;
      },
    });
  }

  onCreateChart() {

    const formatoNumeros = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    var options = {
      series: [{
        name: 'Kg',
        data: this.valuesLinea,
      }],
      chart: {
        type: 'bar',
        height: 450
      },
      fill: {
        colors: ['#0074D9']
      },
      plotOptions: {
        bar: {
          borderRadius: 4,
          borderRadiusApplication: 'end',
          horizontal: true,
        }
      },
      dataLabels: {
        enabled: true,
        formatter: function (val: number) {
          return formatoNumeros.format(val)
        }
      },
      xaxis: {
        categories: this.labelsLinea
      },
      tooltip: {
        y: {
          formatter: function (val: number) {
            return formatoNumeros.format(val)
          }
        }
      }
    };

    var chart = new ApexCharts(document.querySelector("#chart"), options);
    chart.render();
  }

  onCreateChartCombinacioncriterios() {

    const formatoNumeros = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });


    var options = {
      series: [{
        name: 'Kgs',
        type: 'column',
        data: this.kgCombinacionCriterios

      }, {
        name: 'Unidades',
        type: 'line',
        data: this.unidadesCombinacionCriterios

      }],
      chart: {
        height: 470,
        type: 'line',
        background: '#FFFFFF',
        toolbar: {
          show: true
        }
      },
      colors: ['#0074D9', '#2ECC40'],
      stroke: {
        width: [0, 6] // Sin línea para la columna, línea más marcada para 'Unidades'
      },
      plotOptions: {
        bar: {
          columnWidth: '65%',
          borderRadius: 4
        }
      },
      dataLabels: {
        enabled: true,
        enabledOnSeries: [1],
        formatter: function (val: any) {
          return val.toFixed(0);
        },
        style: {
          fontSize: '11px'
        }
      },
      labels: this.labelsCombinacionCriterios,
      xaxis: {
        categories: this.labelsCombinacionCriterios,
        labels: {
          rotate: -30
        }
      },
      yaxis: [{
        title: {
          text: 'Kgs'
        },
        labels: {
          formatter: function (value: any) {
            return new Intl.NumberFormat('es-CO', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }).format(value);
          }
        }

      }, {
        opposite: true,
        title: {
          text: 'Unidades'
        },
        labels: {
          formatter: function (value: any) {
            return new Intl.NumberFormat('es-CO', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(value);
          }
        }
      }],

      tooltip: {
        shared: true,
        intersect: false,
        y: {
          formatter: function (val: number) {
            return formatoNumeros.format(val)
          }
        }
      },
      legend: {
        position: 'top'
      },
      title: {
        text: 'Combinación de criterios | KGs - Unidades',
        align: 'left',
        style: {
          fontSize: '16px',
          fontWeight: 'bold'
        }
      }
    };

    var chart = new ApexCharts(document.querySelector("#chartCombinacionCriterios"), options);
    chart.render();
  }

  applyFilter(event: Event) {

    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

  }

  applyFilterLinea(event: Event) {

    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSourceLinea.filter = filterValue.trim().toLowerCase();

  }


  ABCItem(rotacion: any) {

    switch (rotacion) {
      case 'A':
        return 'text-success';
      case 'B':
        return 'text-warning';
      case 'C':
        return 'text-danger';
      default:
        return 'text-warning';
    }

  }


  toggleLinea(element: any): void {

    const key = element.descripcionLinea;
    this.detallesLineaSeleccionada = Object.values(element.detalleItemsLinea);
    console.log(this.detallesLineaSeleccionada);


    if (this.expandedLineas.has(key)) {
      this.expandedLineas.delete(key);
    } else {
      this.expandedLineas.add(key);
    }
  }

  isLineaExpanded(key: string): boolean {
    return this.expandedLineas.has(key);
  }

  reloadPage() {
    window.location.reload();
  }

}
