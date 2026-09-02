import { Component, inject, ViewChild } from '@angular/core';
import { BodegasService } from '../../services/bodegas/bodegas.service';
import ApexCharts from 'apexcharts';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MaterialModule } from '../../material.module';
import { MatFormFieldModule } from '@angular/material/form-field';
import { DecimalPipe, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-panel-control-bodegas',
  standalone: true,
  imports: [
    MaterialModule,
    MatPaginatorModule,
    MatTableModule,
    MatSortModule,
    MatFormFieldModule,
    CommonModule,
    MatProgressBarModule,
    FormsModule
  ],
  templateUrl: './panel-control-bodegas.component.html',
  styleUrl: './panel-control-bodegas.component.css',
  providers: [DecimalPipe],
})

export class PanelControlBodegasComponent {

  public labelsInventary: any;
  public dataInventary: any;
  public labelsLinea: any;
  public dataLinea: any;
  public productosSinInventario: any;
  public canastas: any;
  public canastillas: any;
  public bodegaSeleccionada: {codigo: string, descripcion: string} = {codigo: 'PT001', descripcion: 'PRODUCTO TERMINADO PRADO'} ;
  public bodegas : {codigo: string , descripcion:string}[] = [];
  public pesoTotal: any;
  public unidadesTotales: any;
  public chartLinea: any;
  public chartInventario: any;
  public cargando: boolean = false;
  public filtroBodega: string = "";
  private _liveAnnouncer = inject(LiveAnnouncer);
  displeyColumns: string[] = [
    'referencia',
    'descripcion',
    'Existencia_1',
    'Existencia_2',
    'abc_rotacion_veces'
  ];
  displayColumnsConCantidades: string[] = [
    'referencia',
    'descripcion',
    'Existencia_1',
    'Existencia_2',
    'abc_rotacion_veces'
  ]
  @ViewChild('paginatorSinInformacion') paginator!: MatPaginator;
  @ViewChild('sortSinInformacion') sort!: MatSort;
  @ViewChild('paginatorInformacion') paginatorConinfo!: MatPaginator;
  @ViewChild(MatSort) sortConinfo!: MatSort;

  dataSourceInventarioConCantidades: MatTableDataSource<any> = new MatTableDataSource<any>();
  dataSource = new MatTableDataSource<any>();

  constructor(
    private _bodegaService: BodegasService,
    private decimalPipe: DecimalPipe,
    private _router: Router
  ) { }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;

    setTimeout(() => {

      this.cargando = true;
      this.onGetInventarioXbodega();
      this.dataSourceInventarioConCantidades.paginator = this.paginatorConinfo;
      this.dataSourceInventarioConCantidades.sort = this.sortConinfo;
    });
    this.onConsultarBodegas();

  }

  ngOnInit(): void { }

  onGetInventarioXbodega() {

    this._bodegaService.consultarInventarioxBodega(this.bodegaSeleccionada.codigo).subscribe({
      next: (response) => {
        if (response.body) {
          this.labelsInventary = response.body.labels;
          this.dataInventary = response.body.data;
          this.labelsLinea = response.body.labelsLinea;
          this.dataLinea = response.body.dataLinea;
          this.dataSource.data = response.body.productosSinInventario;
          this.dataSourceInventarioConCantidades.data = response.body.productosConInventario;

          const canastasFormat = this.decimalPipe.transform(
            response.body.canastas,
            '1.0-0'
          );

          const canastillasFormat = this.decimalPipe.transform(
            response.body.canastillas,
            '1.0-0'
          );

          this.pesoTotal = this.decimalPipe.transform(
            response.body.totalPeso,
            '1.0-0'
          );

          this.unidadesTotales = this.decimalPipe.transform(
            response.body.totalUnidades,
            '1.0-0'
          );

          this.canastas = canastasFormat;
          this.canastillas = canastillasFormat;

          this.onCreateChart();
          this.onCreateCharLinea();
        }
        this.cargando = false;
        if (response.body?.aviso) {
          Swal.fire({
            title: 'Inventario sin existencias',
            text: response.body.aviso,
            icon: 'info',
          });
        }
      },
      error: (error) => {
        console.error(error);
        this.cargando = false;
        Swal.fire({
          title: 'No se pudo consultar el inventario',
          text:
            error?.error?.body?.message ||
            'SIESA Connekta no respondió existencias por bodega.',
          icon: 'error',
        });
      },
    });
  }

  onCreateChart() {

    const formatoNumeros = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    if (this.chartInventario) {

      this.chartInventario.destroy();
    }
    var options = {
      series: [{
        name: "Kg",
        data: this.dataInventary,
      }],
      chart: {
        height: 350,
        type: 'bar',
      },
      plotOptions: {
        bar: {
          columnWidth: '45%',
          distributed: true,
        }
      },
      dataLabels: {
        enabled: false
      },
      legend: {
        show: false
      },
      xaxis: {
        categories: this.labelsInventary,
        labels: {
          style: {
            fontSize: '8px'
          },
        }
      },
      tooltip: {
        y: {
          formatter: function (val: number) {
            return formatoNumeros.format(val);
          }
        }
      },
      yaxis: {
        labels: {
          formatter: function (value: any) {
            return new Intl.NumberFormat('es-CO', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }).format(value);
          }
        }
      },

    };

    this.chartInventario = new ApexCharts(document.querySelector("#chart"), options);
    this.chartInventario.render();

  }

  onCreateCharLinea() {

    const formatoNumeros = new Intl.NumberFormat('es-CO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    if (this.chartLinea) {
      this.chartLinea.destroy();
    }
    var options = {
      series: [{
        name: "Kg",
        data: this.dataLinea,
      }],
      chart: {
        type: 'bar',
        height: 350
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
      },
    };

    this.chartLinea = new ApexCharts(document.querySelector("#chartLinea"), options);
    this.chartLinea.render();

  }

  applyFilter(event: Event) {

    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

  }

  applyFilterConInfo(event: Event) {

    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSourceInventarioConCantidades.filter = filterValue.trim().toLowerCase();

  }

  announceSortChange(sortState: Sort) {
    if (sortState.direction) {
      this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
    } else {
      this._liveAnnouncer.announce('Sorting cleared');
    }
  }

  onChangeBodega(bodega: string, descripcion: string) {

    if (bodega === 'todas') {

      this._router.navigate(['/configuracion/inventarioTotalCompania']);

    } else {
      this.cargando = true;
      this.bodegaSeleccionada = {codigo: bodega, descripcion: descripcion};
      this.onGetInventarioXbodega();
    }

  }

  ABCitem(valoritem: any) {

    switch (valoritem) {
      case 'A':
        return 'text-success';
      case 'B':
        return 'text-warning';
      case 'C':
        return 'text-danger';
      default:
        return 'text-danger';

    }

  }

  onConsultarBodegas(){

    this._bodegaService.onConsultarBodegas().subscribe({
      next: (response) => {
        if (response.body) {
          this.bodegas = response.body;
        }
      },
      error: (error) => {
        console.error(error);
        this.bodegas = [];
      },
    });
  }

  get onBodegasFiltradas(){

    if (!this.filtroBodega) {
      
      return this.bodegas;

    }
    return this.bodegas.filter(b => `${b.codigo} - ${b.descripcion}`.toLowerCase().includes(this.filtroBodega.toLowerCase())); ; 
  }
}
