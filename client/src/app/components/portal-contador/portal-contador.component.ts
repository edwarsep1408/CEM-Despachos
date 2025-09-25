import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { RouterModule, Router, ActivatedRoute, Params } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import SignaturePad from 'signature_pad';
import Swal from 'sweetalert2';
import {
  FormGroup,
  Validators,
  FormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';

/* SERVICES  */

import { SocketService } from '../../services/socket/socket.service';
import { ConteoService } from '../../services/conteo/conteo.service';
import { PlanillasService } from '../../services/planillas/planillas.service';
import { ItemsService } from '../../services/items/items.service';
import { PersonalService } from '../../services/personal/personal.service';

declare var bootstrap: any;

@Component({
  selector: 'app-portal-contador',
  standalone: true,
  imports: [RouterModule, CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './portal-contador.component.html',
  styleUrl: './portal-contador.component.css',
})
export class PortalContadorComponent implements OnInit {
  private myModal: any;
  private myModaDiferencia: any;

  @ViewChild('signature') signaturePadElementRef!: ElementRef;
  @ViewChild('numeroCanastasInput') numeroCanastasInput!: ElementRef;
  signaturePad!: SignaturePad;
  isDrawing = false;

  /* FORMULARIO */

  miFormulario!: FormGroup;
  btnSubmitFormulario: boolean = false;

  diferencia: boolean = false;

  colaboradorId: any;
  colaboradorData: any;
  mesaData: any;
  itemProductoData: any;
  planillaData: any;
  bodegaData: any;
  fechaInicioInventario: any;
  conteoData: any;

  firma: any;

  /* PRODUCTO */

  itemsData: any = [];
  selectedProducto: any;

  isConnected: boolean = false;

  intervaloId: any;

  constructor(
    private _personalService: PersonalService,
    private _itemsService: ItemsService,
    private _planillasService: PlanillasService,
    private _conteoService: ConteoService,
    private _socketService: SocketService,
    private elementRef: ElementRef,
    private fb: FormBuilder
  ) {
    this.colaboradorId = localStorage.getItem('colaborador');

    this.miFormulario = this.fb.group({
      numero_canastas: ['', [Validators.required, this.noDecimalValidator]],
      numero_canastillas: ['', [Validators.required, this.noDecimalValidator]],
      numero_bultos: ['', [Validators.required, this.noDecimalValidator]],
      numero_cajas: ['', Validators.required],
      carreta: ['', Validators.required],
      kg_pesados: ['', Validators.required],
      unidades_contadas: ['', [Validators.required, this.noDecimalValidator]],
    });
  }

  ngAfterViewInit() {
    this.signaturePad = new SignaturePad(
      this.signaturePadElementRef.nativeElement
    );

    this.myModal = new bootstrap.Modal(
      this.elementRef.nativeElement.querySelector('#staticBackdrop'),
      {}
    );

    this.myModaDiferencia = new bootstrap.Modal(
      this.elementRef.nativeElement.querySelector('#diferenciaModal'),
      {}
    );

    this.openModalSing();
    this.openModalDiferencia();
  }

  ngOnDestroy(): void {
    // Cuando el componente se destruye, cancelar el intervalo
    clearInterval(this.intervaloId);
    console.log('Intervalo cancelado.');
  }

  ngOnInit(): void {
    this.onGetPersonal();
    this.onGetPlanilla();
    this.event();
    this.subscribeRoom();
  }

  event() {
    /* this.measureLatency() */

    this._socketService.isConnected$.subscribe((connected) => {
      this.isConnected = connected;

      if (!this.isConnected) {
        const Toast = Swal.mixin({
          position: 'top-right',
          toast: true,
          showConfirmButton: false,
        });

        Toast.fire({
          icon: 'error',
          title: 'Estás Desconectado',
        });

        this.planBExecute();
      } else {
        clearInterval(this.intervaloId);
        Swal.close();
        this.subscribeRoom();
      }
    });
    this._socketService.eventOnSubscribedRoom().subscribe((res: any) => {
      const Toast = Swal.mixin({
        position: 'top',
        toast: true,
        showConfirmButton: false,
        timer: 4000,
        timerProgressBar: true,
      });

      Toast.fire({
        icon: 'success',
        title: `Estas en la ${res.dataRoom.nombre}`,
      });
    });
    this._socketService.eventOnNewPlanilla().subscribe((res: any) => {
      this.onGetPlanilla();
    });
    this._socketService.eventOnPlanillaFinalizada().subscribe((res: any) => {
      if (res.finalizar === true) {
        const Toast = Swal.mixin({
          position: 'top',
          toast: true,
          showConfirmButton: false,
          timer: 4000,
          timerProgressBar: true,
        });

        Toast.fire({
          icon: 'success',
          title: `La planilla fue finalizada`,
        });
        this.onGetPlanilla();
        localStorage.removeItem('finalizarPlanilla');
        this.openModalSing();
        return;
      }

      const Toast = Swal.mixin({
        position: 'top',
        toast: true,
        showConfirmButton: false,
        timer: 4000,
        timerProgressBar: true,
      });

      Toast.fire({
        icon: 'error',
        title: `La planilla no fue finalizada`,
      });
    });
    this._socketService.eventOnPlanillaFirmar().subscribe((res: any) => {
      localStorage.setItem('finalizarPlanilla', res.finalizar);

      this.openModalSing();
      this.onGetPlanilla();
    });
    this._socketService.eventOnDiferencias().subscribe((res: any) => {
      if (res.differenceData) {
        localStorage.setItem('diferencia', res.differenceData);
        this.openModalDiferencia();
      } else {
        localStorage.removeItem('diferencia');
        this.closedModalDiferencia();
      }
    });
    this._socketService.eventOnActualizarConteo().subscribe((res: any) => {
      this.onGetConteo();
    });
    this._socketService.eventOnAlertaResetBasucla().subscribe((res: any) => {
      if (res.resetBascula) {
        Swal.fire({
          title: 'Resetear Indicador Bascula',
          text: 'Por favor resetee el indicador de la bascula en 0',
          icon: 'warning',
        });
      }
    });
  }

  measureLatency(): void {
    this._socketService.checkLatency();
    setInterval(() => {
      this._socketService.checkLatency();
    }, 10000);
  }

  subscribeRoom() {
    this._socketService.emitSocket('subscribe-room', {
      mesaId: localStorage.getItem('mesa'),
    });
  }

  onGetPersonal() {
    this._personalService.GetPersonal(this.colaboradorId).subscribe(
      (response) => {
        this.colaboradorData = response.body;
        this.mesaData = response.body.mesa;
        this.bodegaData = response.body.bodega;
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

  onGetPlanilla() {
    let mesaId = localStorage.getItem('mesa');
    let bodega = localStorage.getItem('bodega');

    this._planillasService.Get(mesaId, bodega).subscribe(
      (response) => {
        localStorage.setItem('planilla', response.body._id);
        this.planillaData = response.body;
        this.itemProductoData = response.body.producto;
        this.onGetConteo();
        this.onGetEventosPlanilla();
      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {
            this.planillaData = null;
            this.itemProductoData = null;
            this.conteoData = null;

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

  onGetConteo() {
    let planilla_id = localStorage.getItem('planilla');

    let mesaId = localStorage.getItem('mesa');

    this._conteoService.Get(planilla_id, mesaId).subscribe(
      (response) => {
        this.conteoData = response.body;
      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {
            this.conteoData = null;

            const Toast = Swal.mixin({
              position: 'top',
              toast: true,
              showConfirmButton: false,
              timer: 4000,
              timerProgressBar: true,
            });

            Toast.fire({
              icon: 'info',
              title: 'No hay conteos',
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

  backInicio() {
    this._socketService.emitSocket('unsubscribe-room', {
      mesaId: localStorage.getItem('mesa'),
    });
    localStorage.clear();
  }

  onSignatureClear() {
    this.signaturePad.clear();
  }

  onSignatureEnd() {
    this.isDrawing = true;
    const signatureBase64 = this.signaturePad.toDataURL();
    this.firma = signatureBase64;
  }

  openModalSing() {
    const data = localStorage.getItem('finalizarPlanilla');
    if (data === 'true') {
      this.myModal.show();
    }
  }

  closedModalSing() {
    this.myModal.hide();
  }

  openModalDiferencia() {
    const data = localStorage.getItem('diferencia');

    if (data == 'true') {
      this.myModaDiferencia.show();
    }
  }

  closedModalDiferencia() {
    this.myModaDiferencia.hide();
  }

  onSubmitSign() {
    let body = {
      planilla: localStorage.getItem('planilla'),
      bodega: localStorage.getItem('bodega'),
      mesa: localStorage.getItem('mesa'),
      colaborador: localStorage.getItem('colaborador'),
      firma: this.firma,
    };
    this._planillasService.PostValidarFirma(body).subscribe(
      (response) => {
        this.closedModalSing();

        this.signaturePad.clear();
        this.firma = null;

        localStorage.removeItem('finalizarPlanilla');

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
          text: 'Firmar registrada con éxito',
        });
      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;
          if (error.status == 400) {
            const Toast = Swal.mixin({
              toast: true,
              position: 'top',
              showConfirmButton: false,
              timer: 4000,
              timerProgressBar: true,
            });

            Toast.fire({
              icon: 'info',
              title: 'La planilla ya esta agregada',
            });
          }
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

  campoEsInvalido(campo: string): boolean {
    const control = this.miFormulario.get(campo);
    return control!.touched && control!.invalid;
  }

  OnSubmitConteo() {
    this.btnSubmitFormulario = true;

    let data = {
      ...this.miFormulario.value,
      planilla: localStorage.getItem('planilla'),
      bodega: localStorage.getItem('bodega'),
      mesa: localStorage.getItem('mesa'),
      producto: this.selectedProducto._id,
      colaborador: this.colaboradorData._id,
      conteo: this.conteoData._id,
    };

    this._conteoService.Post(data).subscribe(
      (response) => {
        this.btnSubmitFormulario = false;
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
          text: 'Conteo registrada con éxito',
        });

        this.miFormulario.reset();
        this.selectedProducto = null;
        this.onGetPlanilla();
        this.onGetConteo();
      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;
          if (error.status == 404) {
            Swal.fire({
              icon: 'info',
              title: body.body.message,
              confirmButtonText: 'Cerrar',
            }).then((result) => {
              if (result.isConfirmed) {
                this.cancelSelectedItem();
              }
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

  searchItems(event: KeyboardEvent) {
    let value = (event.target as HTMLInputElement).value;

    if (value.length < 3) {
      return;
    }

    if (value.trim() === '') {
      this.itemsData = [];
      return;
    }

    this._itemsService.GetSearch(value).subscribe(
      (response) => {
        this.itemsData = response.body;
      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {
            this.itemsData = [];
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

  selectedItem(item: any) {

    
    this.selectedProducto = item;
    /* Se espera a que se termine de renderizar el componente y después se le agrega el focus al form */
    setTimeout(() => {
      
      if (this.numeroCanastasInput) {
        
        this.numeroCanastasInput.nativeElement.focus();

      }

    }, 0);
    this.itemsData = [];
  }

  cancelSelectedItem() {
    this.selectedProducto = null;
    this.miFormulario.reset();
    this.btnSubmitFormulario = false;
  }

  onGetEventosPlanilla() {
    let planilla_id = localStorage.getItem('planilla');
    let mesaId = localStorage.getItem('mesa');

    this._planillasService.GetEventPlanilla(planilla_id, mesaId).subscribe(
      (response) => {
        response.body.map((item: any) => {
          if (item.nombreEvento === 'Firmar') {
            localStorage.setItem('finalizarPlanilla', 'true');
            this.openModalSing();
          } else {
            localStorage.removeItem('finalizarPlanilla');
            this.closedModalSing();
          }

          if (item.nombreEvento === 'Diferencia') {
            this.diferencia = true;
            localStorage.setItem('diferencia', 'true');
            this.openModalDiferencia();
          } else {
            this.diferencia = false;
            localStorage.removeItem('diferencia');
            this.closedModalDiferencia();
          }
        });
      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {
            localStorage.removeItem('finalizarPlanilla');
            this.closedModalSing();

            this.diferencia = false;
            localStorage.removeItem('diferencia');
            this.closedModalDiferencia();

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

  noDecimalValidator(control: any) {
    const value = control.value;

    console.log(value);
    if (
      value &&
      (value.toString().indexOf('.') !== -1 ||
        value.toString().indexOf(',') !== -1)
    ) {
      return { decimal: true };
    }
    return null;
  }

  planBExecute() {
    this.onGetPlanilla();
    this.intervaloId = setInterval(() => {
      this.onGetPlanilla();
    }, 5000);
  }


}
