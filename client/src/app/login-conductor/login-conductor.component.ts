import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterModule } from "@angular/router";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { SesionService } from "../services/sesion/sesion.service";
import Swal from "sweetalert2";

@Component({
  selector: "app-login-conductor",
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: "./login-conductor.component.html",
  styleUrls: ["../login/login.component.css", "./login-conductor.component.css"],
})
export class LoginConductorComponent implements OnInit {
  form: FormGroup;
  cargando = false;

  constructor(
    private router: Router,
    private sesion: SesionService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      placa: ["", [Validators.required, Validators.pattern(/^[A-Za-z]{3}[0-9]{3}$/)]],
      password: ["", Validators.required],
    });
  }

  ngOnInit() {
    this.sesion.cerrarSesion();
  }

  onPlacaInput(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const limpia = String(input.value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
    this.form.get("placa")?.setValue(limpia, { emitEvent: false });
    input.value = limpia;
  }

  onSubmit() {
    if (this.form.invalid || this.cargando) {
      this.form.markAllAsTouched();
      return;
    }
    this.cargando = true;
    this.form.disable();
    const { placa, password } = this.form.getRawValue();
    this.sesion.loginConductor(placa, password).subscribe({
      next: (response) => {
        this.sesion.guardarSesion(response.token, response.identity);
        this.router.navigate(["/portal-conductor"]);
      },
      error: (error) => {
        this.cargando = false;
        this.form.enable();
        Swal.fire({
          toast: true,
          position: "top",
          icon: "error",
          title:
            error?.error?.body?.message ||
            (error.status === 0 ? "No hay conexión con el servidor." : "No se pudo iniciar sesión."),
          showConfirmButton: false,
          timer: 4000,
        });
      },
    });
  }
}
