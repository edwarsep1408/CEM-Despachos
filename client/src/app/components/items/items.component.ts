import { Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort, SortDirection } from '@angular/material/sort';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';

/* SERVICES */
import { ItemsService } from "../../services/items/items.service";
import { MaterialModule } from '../../material.module'

export interface PeriodicElement {
  nombre: string;
  item: string;
  codigoItem: string;
  referencia: string;
  descCorta: string
  idTipoinventario: string
  descTipoInventario: string
  undInventario: string
  undAdicional: string
  linea: string
}

@Component({
  selector: 'app-items',
  standalone: true,
  imports: [MaterialModule, CommonModule],
  templateUrl: './items.component.html',
  styleUrl: './items.component.css'
})
export class ItemsComponent implements OnInit {

  file?: File;
  cargando: boolean = false;
  displayedColumns: string[] = [
    'item',
    'codigoItem',
    'referencia',
    'descripcion',
    'descCorta',
    'idTipoinventario',
    'undInventario',
    'undAdicional',
    'estado'
  ];
  dataSource: MatTableDataSource<PeriodicElement> = new MatTableDataSource<PeriodicElement>();;
  ultimaSincronizacion: any = [];
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  unidadesMedida: any = []


  constructor(private _itemsService: ItemsService) {

  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.OnGet()
    this.onInformacionUltimaSincronizacion();
  }


  ngOnInit(): void {
  }

  OnGet() {
    this._itemsService.Get().subscribe(
      (response) => {
        console.log(response.body)
        this.dataSource.data = response.body as PeriodicElement[];
      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {

            this.dataSource.data = [] as PeriodicElement[];

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

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;

    this.dataSource.filter = filterValue.trim();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  onchangeExcel(event: any) {
    if (event.target.files && event.target.files[0]) {
      this.file = <File>event.target.files[0];
    }
  }

  onUploadExcel() {
    this._itemsService.Post(this.file).subscribe(
      (response) => {

        const Toast = Swal.mixin({
          position: 'top',
          toast: true,
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true,
        });

        Toast.fire({
          icon: 'info',
          title: '¡Registro Exitoso!',
          text: 'Se cargo la información correctamente '
        });

        this.OnGet()

      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {

            const Toast = Swal.mixin({
              toast: true,
              position: 'top',
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
 
  onSincronizarReferencias() {
    this.cargando = true;
    let usuario = localStorage.getItem("user");
    this._itemsService.onSincronizarReferenciasunoee(usuario).subscribe({
      next: (response) => {
        
        if (response.status == 200) {
          Swal.fire({
            title: "Sincronización exitosa",
            text: "Se crearon " + response.body.total_nuevos_registros + " referencia(s) nueva(s). Se actualizaron " + response.body.registros_actualizados + " registro(s).",
            icon: "success"
          });
          this.OnGet();
          this.onInformacionUltimaSincronizacion();
          this.cargando = false;
        } else {
          Swal.fire({
            title: "Sincronización con problemas",
            text: "La sincronización no se pudo completar, por favor intente nuevamente",
            icon: "error"
          });
        }
      },
      error: (error) => { console.error(error) }
    });
  }

  onInformacionUltimaSincronizacion() {

    this._itemsService.onInformacionUltimaSincronizacion().subscribe({
      next: (response) => {        
        
        if (response.status == 200) { 

          this.ultimaSincronizacion = response.body;
       
        }
        
      },
      error: (error) => { console.error(error) }
    });

  }

}
