import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute, Params } from '@angular/router';

import Swal from "sweetalert2";

/* SERVICES */

import { BodegasService } from "../../services/bodegas/bodegas.service";
import { SesionService } from '../../services/sesion/sesion.service';
import { ValidarBodegaMesaService } from "../../services/validarBodegaMesa/validar-bodega-mesa.service";

/* MODELS */

import { AddForm } from "../../models/validarMesa";

@Component({
  selector: 'app-verificar-bodega',
  standalone: true, 
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './verificar-bodega.component.html',
  styleUrl: './verificar-bodega.component.css'
})

export class VerificarBodegaComponent implements OnInit {

  bodegasData: any = [];
  registrarBodega: FormGroup;
  statusSession: boolean = false
  token: string = ''
  addForm: AddForm;
  errorMessage: any

  constructor(private bodegasService: BodegasService, private _router: Router, private _route: ActivatedRoute, private sessionService: SesionService, private validarBodegaMesaService: ValidarBodegaMesaService) {

    this.registrarBodega = new FormGroup({
      bodega: new FormControl(''),
      cedula: new FormControl(''),
    });
    
    this.addForm = new AddForm('', '')

    this._route.queryParamMap.subscribe(params => {
      const tokenVal = params.get('auth') || '';

      if (tokenVal) {

        this.token = this.token;

      }      

    })
  }

  ngOnInit(): void {
    this.OnvalidateToken()
    this.OnGet()
  }

  OnGet() {
    this.bodegasService.Get().subscribe({
      next: (response) => {

        this.bodegasData = response.body;
      },
      error:
        (error) => {
          var errorMessage = <any>error;

          if (errorMessage != null) {
            var body = error.error;

            if (error.status == 404) {

              this.bodegasData = [];

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
    }
    );
  }

  async OnvalidateToken() {


    const tokenLocalStorage = this.sessionService.getToken()

    if (tokenLocalStorage === null) {


      this.statusSession = false

      if (this.token === null) {
        this.statusSession = false
        return
      }

      this.sessionService.Post(this.token).subscribe({
        next: (response) => {

          this.statusSession = true;
          localStorage.setItem('token', response.token);
          localStorage.setItem('user', response.identity.nombre);
          localStorage.setItem('correo', response.identity.nombre);
          localStorage.setItem('message', 'noneccesarynow');
        },
        error:
          (error) => {
            var errorMessage = <any>error;

            if (errorMessage != null) {
              var body = error.error;

              this.statusSession = false;
              if (error.status == 500) {
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
      })
    }

    this.statusSession = true

  }

  onSubmit() {
    this.validarBodegaMesaService.Post(this.registrarBodega.value).subscribe(
      (response) => {

        localStorage.setItem('bodega', response.body.bodega._id);
        localStorage.setItem('mesa', response.body.mesa._id);
        localStorage.setItem('colaborador', response.body._id);
        this.registrarBodega.reset()

        if (response.body.perfil === 'Coordinador') {
          this._router.navigate(['/portal-coordinador', response.body.bodega._id, response.body.mesa._id])
        } else {
          this._router.navigate(['/portal-contador', response.body.bodega._id, response.body.mesa._id])
        }
      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;
          this.errorMessage = body.body.message

          if (error.status == 500) {
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
