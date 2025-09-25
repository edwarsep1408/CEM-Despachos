import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort, SortDirection } from '@angular/material/sort';
import {
  FormGroup,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import Swal from 'sweetalert2';

/* SERVICES */

import { SocketService } from '../../services/socket/socket.service';
import { BodegasService } from '../../services/bodegas/bodegas.service';
import { PlanillasService } from '../../services/planillas/planillas.service';

@Component({
  selector: 'app-planillas',
  standalone: true,
  imports: [MaterialModule, CommonModule, ReactiveFormsModule],
  templateUrl: './planillas.component.html',
  styleUrl: './planillas.component.css',
})
export class PlanillasComponent implements OnInit {
  displayedColumns: string[] = [
    'codigo',
    'descripcion',
    'suma_kilos',
    'suma_unidades',
    'promedio',
  ];
  dataSource: MatTableDataSource<any> = new MatTableDataSource<any>();

  bodegas: any = [];
  years: any = [];
  meses: any = [];

  download: any;
  filename: any;

  miFormulario: FormGroup;

  bodegaSelectFilter: any;

  constructor(
    private fb: FormBuilder,
    private _bodegaService: BodegasService,
    private _planillasService: PlanillasService,
    private _socketService: SocketService
  ) {
    this.miFormulario = this.fb.group({
      bodega: ['', Validators.required],
      ano: ['', Validators.required],
      fecha: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.onGetBodega();
    this.OnGet();
    this.event();
  }

  event() {
    this._socketService.eventOnActualizarConteoAdmin().subscribe((res: any) => {
      console.log('hola');
      this.OnGet();
    });
  }

  onGetBodega() {
    this._bodegaService.Get().subscribe(
      (response) => {
        this.bodegas = response.body;
      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {
            this.bodegas = [];

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

  OnGet() {
    this._planillasService.GetResumen().subscribe(
      (response) => {
        this.dataSource.data = response.body;
      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {
            this.dataSource.data = [];

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

  OnGetFilter(event: any) {
    if (event && event.target) {
      const valorInput = event.target.value;
      this._planillasService.GetResumenFilter(valorInput).subscribe(
        (response) => {
          this.dataSource.data = response.body;
        },
        (error) => {
          var errorMessage = <any>error;

          if (errorMessage != null) {
            var body = error.error;

            if (error.status == 404) {
              this.dataSource.data = [];

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
  }

  exportDocumentPdf() {
    const date = new Date();

    const nameFile = `${date.getFullYear()}${date.getDay()}${date.getMonth()}`;

    this.filename = `${nameFile}.xlsx`;

    this._planillasService
      .GetResumenExcel(
        this.miFormulario.get('bodega')?.value,
        this.miFormulario.get('ano')?.value,
        this.miFormulario.get('fecha')?.value,
        nameFile
      )
      .subscribe((res: any) => {
        this.download = res;

        if (res.state == 'HECHO') {
          let element: HTMLElement = document.getElementsByClassName(
            'btn-close-download'
          )[0] as HTMLElement;
          element.click();
        }
      });
  }

  OnGetyearsFilter(event: any) {
    if (event && event.target) {
      console.log("valores despues de enviar", event.target.value);;
      
      const valorInput = event.target.value;

      this.bodegaSelectFilter = valorInput;

      this._planillasService.GetYearsFilter(valorInput).subscribe(
        (response) => {
          this.years = response.body;
        },
        (error) => {
          var errorMessage = <any>error;

          if (errorMessage != null) {
            var body = error.error;

            if (error.status == 404) {
              this.years = [];

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
  }

  OnGetMonthFilter(event: any) {
    if (event && event.target) {
      const valorInput = event.target.value;

      this._planillasService
        .GetMonthFilter(this.bodegaSelectFilter, valorInput)
        .subscribe(
          (response) => {
            this.meses = response.body;
          },
          (error) => {
            var errorMessage = <any>error;

            if (errorMessage != null) {
              var body = error.error;

              if (error.status == 404) {
                this.meses = [];

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
  }

  resetForm() {
    this.miFormulario.reset();
  }
}
