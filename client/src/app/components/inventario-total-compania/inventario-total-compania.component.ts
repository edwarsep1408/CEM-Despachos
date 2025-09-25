import { Component, ViewChild } from '@angular/core';
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
export class InventarioTotalCompaniaComponent {

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
  token: string = ''
  detallesLineaSeleccionada: any = [];
  statusSession: boolean = false

  @ViewChild('paginator') paginator!: MatPaginator;
  @ViewChild('sort') sort!: MatSort;
  @ViewChild('paginatorLinea') paginatorLinea!: MatPaginator;
  @ViewChild('sortLinea') sortLinea!: MatSort;
  dataSource = new MatTableDataSource<any>();
  dataSourceLinea = new MatTableDataSource([]);

  constructor(private _bodegasService: BodegasService, private _router: Router, private _route: ActivatedRoute, private sessionService: SesionService) {



  }

  ngAfterViewInit() {

    setTimeout(() => {
      this.cargando = true;
      this.consultarInventarioCompania();
    });
  }


  consultarInventarioCompania() {

    this._bodegasService.consultarInventarioTotalCompania().subscribe((response) => {

      if (response.body) {
        this.labelsLinea = response.body.labelsLinea;
        this.valuesLinea = response.body.valuesLinea;
        this.bodegasDisponibles = response.body.bodegasDisponibles;
        this.columnasDatatable = ['referencia', 'descripcion', 'rotacion', 'totalCompaniaPeso', 'totalCompaniaUnidades', 'promedioGeneral', ...this.bodegasDisponibles.map((bodega: any) => bodega.desc_bodega)]
        this.dataSource.data = response.body.informacionAgrupadaFront;
        const primeraAsigacion = response.body.detallesLineaFront.map((val: any) => ({
          ...val,
          detalle: false
        }));
        console.log(response.body);
        this.dataSourceLinea.data = primeraAsigacion;
        this.insumosenTransito = response.body.documentosEnTrasporte;
        this.labelsCombinacionCriterios = response.body.labelCombCriterios;
        this.kgCombinacionCriterios = response.body.kgCombCriterios
        this.unidadesCombinacionCriterios = response.body.unidadesCombCriterios;
        this.totalKgs = response.body.totales.totalKgCompania;
        this.totalUnidades = response.body.totales.totalUnidadesCompania;
        this.totalKgMovimento = response.body.totales.totalKgMovimiento;
        this.totalUnidadesMovimiento = response.body.totales.totalUnidadesMovimiento;

        setTimeout(() => {
          /* Inicializar estos valores al final de tener todo renderizado para que aplique los valores */
          this.dataSource.sort = this.sort;
          this.dataSource.paginator = this.paginator;
          this.dataSourceLinea.paginator = this.paginatorLinea;
          this.dataSourceLinea.sort = this.sortLinea;
          this.onCreateChart();
          this.onCreateChartCombinacioncriterios();
        }, 0);

        this.cargando = false;

      }
    });
  }

  ngOnInit(): void {

    setTimeout(() => this.reloadPage(), 200000)

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
