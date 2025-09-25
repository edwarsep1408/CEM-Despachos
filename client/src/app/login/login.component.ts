import { Component } from '@angular/core';
import { RouterModule, Router, ActivatedRoute, Params } from '@angular/router';
import { SesionService } from '../services/sesion/sesion.service';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

  token: string = ''
  statusSession: boolean = false

  constructor(private _router: Router, private _route: ActivatedRoute, private sessionService: SesionService) {


    this._route.queryParamMap.subscribe(params => {
      const tokenVal = params.get('auth') || '';

      if (tokenVal) {
        this.token = tokenVal;
      } else {
        Swal.fire({

          icon: 'error',
          title: 'Se requiere inicio de sesion. Serás redirigido al portal de CEM.',
          
        });

        window.location.href = 'http://192.168.1.252:4300/login'
      }
    })


  }

  ngAfterViewInit() {

    if (!localStorage.getItem('token')) {

      this.OnvalidateToken();

    } else {

      this._router.navigate(['/configuracion/inventarioTotalCompania']);

    }
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
          localStorage.setItem('message', '');

          this._router.navigate(['/configuracion/inventarioTotalCompania']);

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
    } else {

      this._router.navigate(['/configuracion/inventarioTotalCompania']);

    }

    this.statusSession = true

  }


}
