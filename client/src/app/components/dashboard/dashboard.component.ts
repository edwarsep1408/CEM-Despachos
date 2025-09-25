import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormGroup,
  Validators,
  FormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import Swal from 'sweetalert2';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, SortDirection, MatSortModule, Sort } from '@angular/material/sort';
import { MaterialModule } from '../../material.module';
import Chart from 'chart.js/auto';
 
/* SERVICES */

import { SocketService } from '../../services/socket/socket.service';
import { MesasService } from '../../services/mesas/mesas.service';
import { BodegasService } from '../../services/bodegas/bodegas.service';
import { PlanillasService } from '../../services/planillas/planillas.service';
import { ConteoService } from '../../services/conteo/conteo.service';
import { ItemsService } from '../../services/items/items.service';
import { LiveAnnouncer } from '@angular/cdk/a11y';



@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule,
    MatPaginator, MatTableModule, MatSortModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  /* TABLE */

  displayedColumns: string[] = [
    'codigo',
    'descripcion',
    'mesa',
    'numero_conteo',
    'suma_kilos',
    'suma_unidades',
    'promedio',
  ];
  dataSourceResumen: MatTableDataSource<any> = new MatTableDataSource<any>();

  displayedColumnsEventoPlanilla: string[] = [
    'mesa',
    'conteo',
    'bodega',
    'evento',
  ];
  
  dataSourceEventoPlanilla: MatTableDataSource<any> = new MatTableDataSource<any>();

  displayedColumnsCorregir: string[] = [
    'pesaje',
    'conteos',
    'planilla',
    'estado',
    'acciones',
  ];

  dataSourceCorregir: MatTableDataSource<any> = new MatTableDataSource<any>();
  miFormulario: FormGroup;
  formularioCorregir: FormGroup;
  bodegas: any = [];
  years: any = [];
  meses: any = [];
  informacionInventario: any = {};
  informacionPorMesas: any = [];
  mesasSinInformacion: boolean = false;
  informacionMesasSinInformacion: any = [];
  numeroConteo: any;
  bodegaSelectFilter: any;
  dataDashboard: any;
  mesas: any = [];
  selectBodegaCorregir: any;
  chart: any = [];
  conteoDetalles: any = [];
  referenciaCorregir: any;
  productoCorregir: any;
  btnCorregir: boolean = false;
  informacionCorregir: any = [];
  habilitarCorreccion = false;

  private _liveAnnouncer = inject(LiveAnnouncer);

  @ViewChild('paginator') paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;


  datasource = new MatTableDataSource<any>();

  constructor(
    private _planillasService: PlanillasService,
    private _mesasService: MesasService,
    private _bodegaService: BodegasService,
    private _socketService: SocketService,
    private _conteoService: ConteoService,
    private _itemsService: ItemsService,
    private fb: FormBuilder
  ) {
    this.miFormulario = this.fb.group({
      bodega: ['', Validators.required],
      ano: ['', Validators.required],
      fecha: ['', Validators.required],
    });

    this.formularioCorregir = this.fb.group({
      'numero_canastas': ['', Validators.required],
      'numero_canastillas': ['', Validators.required],
      'numero_bultos': ['', Validators.required],
      'numero_cajas': ['', Validators.required],
      'carreta': ['', Validators.required],
      'kg_pesados': ['', Validators.required],
      'unidades_contadas': ['', Validators.required],
    });

  }


  ngOnInit(): void {
    this.event();
  }

  ngAfterViewInit() {
    this.datasource.paginator = this.paginator;
    this.datasource.sort = this.sort;
    /* this.onGet(); */
    this.onGet();
  }

  event() {
    this._socketService.eventOnActualizarConteoAdmin().subscribe((res: any) => {

      /* this.onGet(); */
    });
  }

  onGet() {
    this._planillasService
      .GetInventarioDashBoardByPlanillas(
        this.miFormulario.get('bodega')?.value,
        this.miFormulario.get('ano')?.value,
        this.miFormulario.get('fecha')?.value
      )
      .subscribe(
        (response) => {

          if (response.message === true) {

            this.dataDashboard = response.body;
            this.datasource.data = response.body.resumenInventario;
            this.dataSourceEventoPlanilla = response.body.eventPlanilla;
            this.informacionInventario = response.body.informacionInventario;
            this.informacionPorMesas = response.body.informacionMesas;
            const labelsPie = response.body.labelsPie;
            const valuePie = response.body.valPie

            /* CREAR UNA CHART PARA MOSTRAR INFORMACIÓN- POR AHORA 16 OCT 2024 NO ES INFORMACIÓN REAL */
            this.chart = new Chart("MyChart", {
              type: 'pie', //this denotes tha type of chart

              data: { // values on X-Axis
                labels: labelsPie,
                datasets: [{
                  label: 'Información pendiente de mostrar',
                  data: valuePie,
                  backgroundColor: [
                    'red',
                    'pink',
                    'green',
                    'yellow',
                    'orange',
                  ],
                  hoverOffset: 4
                }],
              },
              options: {
                aspectRatio: 2.5
              }
            });

          }

          if (response.message === false) {

            this.mesasSinInformacion = true;
            this.informacionMesasSinInformacion = response.body.infoPlanillaSinInformacion;

          }
        },

        (error) => {
          var errorMessage = <any>error;

          if (errorMessage != null) {
            var body = error.error;

            if (error.status == 404) {
              const Toast = Swal.mixin({
                position: 'top',
                toast: true,
                showConfirmButton: false,
                timer: 4000,
                timerProgressBar: true,
              });

              Toast.fire({
                icon: 'info',
                title: 'No hay datos por favor Agregue uno',
              });
            } else if (error.status == 500) {
              const Toast = Swal.mixin({
                toast: true,
                position: 'top',
                showConfirmButton: false,
                timer: 4000,
                timerProgressBar: true,
              });

              Toast.fire({
                icon: 'error',
                title: body.message,
              });
            } else if (error.status == 0) {
              const Toast = Swal.mixin({
                toast: true,
                position: 'top',
                showConfirmButton: false,
                timer: 4000,
                timerProgressBar: true,
              });

              Toast.fire({
                icon: 'error',
                title: 'Por favor compruebe su conexión de internet',
              });
            }
          }
        }
      );
  }


  resetForm() {
    this.miFormulario.reset();
  }

  applyFilter(event: Event) {

    const filterValue = (event.target as HTMLInputElement).value;
    this.datasource.filter = filterValue.trim().toLowerCase();

  }

  announceSortChange(sortState: Sort) {
    if (sortState.direction) {
      this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
    } else {
      this._liveAnnouncer.announce('Sorting cleared');
    }
  }

  detalleConteo(fila: any) {
    this.habilitarCorreccion = false;
    this.numeroConteo = fila.numero_conteo;
    this.referenciaCorregir = fila.referencia;
    this.productoCorregir = fila.descripcion;

    this._conteoService.GetConteoDetails(fila._id).subscribe(res => {
      
      this.conteoDetalles = res.body;
      console.log(this.conteoDetalles, "detalles conteo");
      if (this.conteoDetalles.length < 4) {
        this.habilitarCorreccion = true;
      }

    });
  }

  onSubmitCorregir() {

    if (this.conteoDetalles) {
      console.log(this.conteoDetalles);

      const data = {

        ...this.formularioCorregir.value,
        planilla: this.conteoDetalles[0].planilla,
        conteo: this.conteoDetalles[0].conteo._id,
        producto: this.conteoDetalles[0].producto._id,
        colaborador: this.conteoDetalles[0].colaborador,
      }
      this.btnCorregir = true;
      console.log(data, "vvalll");
      this._conteoService.PostCorreccion(data).subscribe(res => {

        if (res.status === 200) {

          Swal.fire({
            title: "Se actualizó el conteo " + this.numeroConteo,
            icon: "success",
            draggable: true
          });

        } else {

          Swal.fire({
            title: "Hubo problemas al corregir el conteo " + this.numeroConteo,
            icon: "error",
            draggable: true
          });
        }
        /* poner habilitarCorreccion en false después de que se habilite */
        console.log("ressss, --------><>", res);

      })

    }



  }

}
