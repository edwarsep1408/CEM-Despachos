import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module'
import { FormsModule } from '@angular/forms';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort, SortDirection } from '@angular/material/sort';

import Swal from 'sweetalert2';

/* SERVICES */
import { MesasService } from "../../services/mesas/mesas.service";
import { BodegasService } from "../../services/bodegas/bodegas.service";

/* MODELS */

import { AddForm, EditForm } from "../../models/mesas";

export interface PeriodicElement {
  nombre: string;
  bodega: string;
}


@Component({
  selector: 'app-mesas',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: './mesas.component.html',
  styleUrl: './mesas.component.css'
})
export class MesasComponent implements OnInit {

  displayedColumns: string[] = ['nombre', 'bodega', 'acciones'];
  dataSource: MatTableDataSource<PeriodicElement> = new MatTableDataSource<PeriodicElement>();;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  unidadesMedida: any = []

  addForm: AddForm;
  editForm: EditForm

  constructor(private _mesasService: MesasService, private _bodegaService: BodegasService) {
    this.addForm = new AddForm('', '')
    this.editForm = new EditForm('', '', '')
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.OnGet()
  }


  ngOnInit(): void {
  }

  OnGet() {
    this._mesasService.Get().subscribe(
      (response) => {
        console.log("----------------------------", response, "----------------------------");
        /* PeriodicElement SE ESPERA ESTE FORMATO DE RESPUESTA */
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
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  onGetUnidadMedida() {

    this._bodegaService.Get().subscribe(
      (response) => {
        this.unidadesMedida = response.body;
        
      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {

            this.unidadesMedida = [];

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

  onSubmit() {
    this._mesasService.Post(this.addForm).subscribe(
      (response) => {
        let closeCanvas = document.querySelector('[data-bs-dismiss="offcanvas"]') as HTMLElement;
        if (closeCanvas != null) {
          closeCanvas.click();
        }


        this.addForm = new AddForm('', '');

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
          text: 'Item registrado con éxito'
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

  onClickDato(element: any) {
    this.editForm = {
      _id: element._id,
      nombre: element.nombre,
      bodega: element.bodega._id,

    }
  }

  onUpdate() {
    this._mesasService.Put(this.editForm).subscribe(
      (response) => {
        let closeCanvas = document.querySelector('[data-bs-dismiss-edit="true"]') as HTMLElement;
        if (closeCanvas != null) {
          closeCanvas.click();
        }

        this.editForm = new EditForm('', '', '');

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
          text: 'Item modificado con éxito'
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

  onDelete(_id: any) {
    Swal.fire({
      title: '¿Está seguro de borrar el item?',
      text: '¡Si no lo está puede cancelar la acción!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Si, borrar item!',
    }).then((result) => {

      if (result.value) {
        this._mesasService.Delete(_id).subscribe(
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
              text: 'Bodega eliminada con éxito'
            });

            this.OnGet();
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
                  position: 'top',
                  toast: true,
                  showConfirmButton: false,
                  timer: 4000,
                  timerProgressBar: true,

                });

                Toast.fire({
                  icon: 'info',
                  title: body.message,
                });

              } else if (error.status == 0) {
                const Toast = Swal.mixin({
                  position: 'top',
                  toast: true,
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
    });
  }

}

