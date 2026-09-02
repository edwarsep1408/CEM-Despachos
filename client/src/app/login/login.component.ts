import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SesionService } from '../services/sesion/sesion.service';
import { PermisosSesion } from '../core/permisos-sesion';
import { environment } from '../../environments/environment';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {

  form: FormGroup;
  cargando = false;
  esLocal = !environment.production;
  private destino(identity?: { perfil?: string; permisos?: string[]; puedeFirmar?: boolean; origen?: string }) {
    const next = this._route.snapshot.queryParamMap.get("next") || "";
    if (next.startsWith("/") && !next.startsWith("//") && next !== "/login") {
      return next;
    }
    if (identity?.puedeFirmar && !(identity?.permisos || []).length) {
      return "/mi-firma";
    }
    if (identity?.origen === "conductor" || String(identity?.perfil || "").toLowerCase() === "conductor") {
      return "/portal-conductor";
    }
    const perfil = String(identity?.perfil || localStorage.getItem("perfil") || "").toLowerCase();
    if (perfil.includes("despachador") && !perfil.includes("admin")) {
      return "/portal-despachador";
    }
    return PermisosSesion.primeraRuta();
  }

  constructor(
    private _router: Router,
    private _route: ActivatedRoute,
    private sessionService: SesionService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      usuario: ['', Validators.required],
      password: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.sessionService.cerrarSesion();

    const ssoToken = this._route.snapshot.queryParamMap.get('auth');
    if (ssoToken) {
      this.validarSso(ssoToken);
    }
  }

  onSubmit(): void {
    if (this.form.invalid || this.cargando) {
      this.form.markAllAsTouched();
      return;
    }

    this.cargando = true;
    this.form.disable();
    const { usuario, password } = this.form.getRawValue();

    this.sessionService.loginLocal(usuario, password).subscribe({
      next: (response) => {
        this.sessionService.guardarSesion(response.token, response.identity);
        this._router.navigate([this.destino(response.identity)]);
      },
      error: (error) => {
        this.cargando = false;
        this.form.enable();
        const message =
          error?.error?.body?.message ||
          (error.status === 0
            ? 'No hay conexión con el servidor local (puerto 3020).'
            : 'No se pudo iniciar sesión.');

        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'error',
          title: message,
          showConfirmButton: false,
          timer: 4000,
        });
      }
    });
  }

  private validarSso(token: string): void {
    this.cargando = true;
    this.sessionService.Post(token).subscribe({
      next: (response) => {
        this.sessionService.guardarSesion(response.token, response.identity);
        this._router.navigate([this.destino(response.identity)]);
      },
      error: () => {
        this.cargando = false;
        this.form.enable();
        Swal.fire({
          toast: true,
          position: 'top',
          icon: 'info',
          title: 'El SSO no respondió. Usa el acceso local.',
          showConfirmButton: false,
          timer: 4000,
        });
      }
    });
  }
}
