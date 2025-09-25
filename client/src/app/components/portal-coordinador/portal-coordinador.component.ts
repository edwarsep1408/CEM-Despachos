import { Component, OnInit, ElementRef } from '@angular/core';
import { RouterModule, Router, ActivatedRoute, Params } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MaterialModule } from "../../material.module";
import { FormGroup, Validators, FormBuilder, ReactiveFormsModule } from '@angular/forms';

import Swal from 'sweetalert2';

/* SERVICES  */

import { SocketService } from "../../services/socket/socket.service"
import { ConteoService } from "../../services/conteo/conteo.service";
import { PlanillasService } from "../../services/planillas/planillas.service";
import { ItemsService } from "../../services/items/items.service";
import { PersonalService } from "../../services/personal/personal.service";


declare var bootstrap: any;

@Component({
  selector: 'app-portal-coordinador',
  standalone: true,
  imports: [RouterModule, CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './portal-coordinador.component.html',
  styleUrl: './portal-coordinador.component.css'
})
export class PortalCoordinadorComponent implements OnInit {

  private myModal: any;

  /* FORMULARIO */

  miFormulario!: FormGroup;

  diferencia: boolean = false

  colaboradorId: any;
  colaboradorData: any;
  mesaData: any;
  itemProductoData: any;
  planillaData: any;
  selectItemPlanilla: any;
  bodegaData: any;
  fechaInicioInventario: any;
  conteoData: any;
  conteoDataResumen: any = []

  /* PRODUCTO */
  itemsData: any = [];
  selectedProducto: any

  /* FIRMAS  FINALIZAR*/

  faltan: any
  firmados: any = []

  /* CONTEO */

  conteosDetails: any = [];
  conteoLogs: any


  /* CONTADORES */

  public users: any[] = [];

  /* ESTADO DE CONEXIÓN */

  isConnected: boolean = false;

  /* RESUMEN DE LOS CONTEOS */

  dataResumenInventario: any

  /* DISCREPANCIA CONTEO */
  btnStatusSubmitDiscrepancia: boolean = false
  /* CORREGIR CONTEO */

  pesajeCorregir: any
  btnStatusSubmitCorregir: boolean = false

  // Lista de imágenes disponibles
  public availableImages: string[] = [
    '../../../assets/img/g584.png',
    '../../../assets/img/g12.png',
    '../../../assets/img/g352.png'
  ];

  constructor(private _personalService: PersonalService, private _itemsService: ItemsService, private _planillasService: PlanillasService, private _conteoService: ConteoService, private _socketService: SocketService, private elementRef: ElementRef, private fb: FormBuilder) {
    this.colaboradorId = localStorage.getItem('colaborador')
    this.miFormulario = this.fb.group({
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
    this.onGetPersonal()
    this.onGetPlanilla()
    this.event()
    this.subscribeRoom()
    this.selectedItem()
  }

  ngAfterViewInit() {

    this.myModal = new bootstrap.Modal(this.elementRef.nativeElement.querySelector('#staticBackdrop'), {});

    this.openModalSing()
  }

  getRandomImage(): string {
    const randomIndex = Math.floor(Math.random() * this.availableImages.length);
    const randomImage = this.availableImages[randomIndex];
    // Elimina la imagen seleccionada de la lista para que no se repita
    this.availableImages.splice(randomIndex, 1);
    return randomImage;
  }

  onImageLoad(user: any): void {
    user.imageLoaded = true;
  }

  event() {
   /*  this._socketService.checkLatency() */
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
        this.onGetPlanilla()
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
    this._socketService.eventOnPlanillaNewFirma().subscribe((res: any) => {
      this.onValidateFirmas()
    });
    this._socketService.eventOnDiferencias().subscribe((res: any) => {
      if (res.differenceData) {

        localStorage.setItem('diferencia', res.differenceData)
        this.openDiferencia()
        Swal.fire({
          title: 'Discrepancia Detectada',
          text: 'Por favor, corrige la discrepancia',
          icon: 'warning',
          confirmButtonText: 'Aceptar',
        });


      } else {

        localStorage.removeItem('diferencia');
        this.diferencia = false

      }


    });
    this._socketService.eventOnActualizarConteo().subscribe((res: any) => {
      this.onGetConteo();
      this.onGetConteoResumen();
      this.onGetPlanillaResumen()
    });
    this._socketService.eventOnUsuarioNuevoConteo().subscribe((res: any) => {
      this.availableImages = [
        '../../../assets/img/g584.png',
        '../../../assets/img/g12.png',
        '../../../assets/img/g352.png']
      // Filtra los usuarios recién conectados
      this.users = res.map((user: any) => ({ id: user, image: this.getRandomImage(), imageLoaded: false }));
    });
    this._socketService.eventOnUsuarioDisconnectedConteo().subscribe((userId: any) => {

      const disconnectedUser = this.users.find(user => user.id === userId);
      if (disconnectedUser) {
        disconnectedUser.imageLoaded = false;
        disconnectedUser.disconnected = true;

        // Elimina al usuario después de cierto tiempo
        setTimeout(() => {
          this.users = this.users.filter(user => user.id !== userId);
        }, 1000); // Ajusta el tiempo según tus necesidades
      }
    });
    this._socketService.isConnected$.subscribe(connected => {
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
      } else {
        Swal.close();
        this.subscribeRoom()
      }
    });
    this._socketService.eventOnAlertaResetBasucla().subscribe((res: any) => {

      if (res.resetBascula) {
        Swal.fire({
          title: "Resetear Indicador Bascula",
          text: "Por favor resetee el indicador de la bascula en 0",
          icon: "warning",
        })
      }

    });
  }

  subscribeRoom() {

    this._socketService.emitSocket('subscribe-room', { mesaId: localStorage.getItem('mesa') })

  }

  onGetPersonal() {

    this._personalService.GetPersonal(this.colaboradorId).subscribe(
      (response) => {
        this.colaboradorData = response.body
        this.mesaData = response.body.mesa
        this.bodegaData = response.body.bodega
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

  onValidateFirmas() {
    let mesaId = localStorage.getItem('mesa');
    let planillaId = localStorage.getItem('planilla');

    this._planillasService.GetValidate(planillaId, mesaId).subscribe(
      (response) => {

        let data = {
          ...this.planillaData,
          mesaId: localStorage.getItem('mesa')
        }
        this._socketService.emitSocket('finalizar-planilla', data)
        localStorage.removeItem('finalizarPlanilla')
        this.closedModalSing()
      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {

            this.faltan = body.body.faltan;
            this.firmados = body.body.colaboradoresFirmados

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

  onSubmitPlanilla() {

    this.btnStatusSubmitDiscrepancia = true

    let data = {
      bodega: this.bodegaData._id,
      mesa: this.mesaData._id,
      colaborador: this.colaboradorData._id,
    }

    this._planillasService.Post(data).subscribe(
      (response) => {
        this.btnStatusSubmitDiscrepancia = false
        localStorage.setItem('planilla', response.body._id)

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
          text: 'Planilla registrada con éxito'
        });

        this.onGetPlanilla()
        this.onGetConteo()
        this.onGetConteoLogs()

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

  onGetPlanilla() {

    let mesaId = localStorage.getItem('mesa');
    let bodega = localStorage.getItem('bodega')
    this._planillasService.Get(mesaId, bodega).subscribe(
      (response) => {
        localStorage.setItem('planilla', response.body._id)
        this.planillaData = response.body;
        this.itemProductoData = response.body.producto;
        this.onGetConteo();
        this.onGetConteoResumen();
        this.onGetConteoLogs();
        this.onGetEventosPlanilla()
        this.onGetPlanillaResumen()
        this.selectItemPlanilla = null;
      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {

            this.planillaData = null
            this.itemProductoData = null
            this.conteoData = null

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

        this.conteoData = response.body

      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {

            this.conteoData = null

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

  onGetConteoResumen() {
    let bodegaId = localStorage.getItem('bodega');

    let mesaId = localStorage.getItem('mesa');

    let planillaId = localStorage.getItem('planilla')

    this._conteoService.GetConteoResumen(bodegaId, mesaId, planillaId).subscribe(
      (response) => {

        this.conteoDataResumen = response.body

        this.onGetConteoDetails()

      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {

            this.conteoDataResumen = []

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

  onGetConteoDetails() {

    if (!this.conteoData) {
      return;
    }

    this._conteoService.GetConteoDetails(this.conteoData._id).subscribe(
      (response) => {

        this.conteosDetails = response.body

      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {

            this.conteosDetails = []

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

  onGetConteoLogs() {
    let planilla_id = localStorage.getItem('planilla');

    this._conteoService.GetLogs(planilla_id).subscribe(
      (response) => {

        this.conteoLogs = response.body

      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {

            this.conteoLogs = null

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

  cancelarPlanilla() {
    this.selectItemPlanilla = null
  }

  searchItems(event: KeyboardEvent) {

    let value = (event.target as HTMLInputElement).value;

    if (value.length < 3) {
      return;
    }

    if (value.trim() === '') {
      this.itemsData = []
      return;
    }

    this._itemsService.GetSearch(value).subscribe(
      (response) => {

        this.itemsData = response.body

      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {

            this.itemsData = []

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

  selectedItemDetails(item: any) {
    this.selectedProducto = item
    this.itemsData = []
  }

  selectedItem() {
    var d = new Date();
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');

    var formattedDate = year + '/' + month + '/' + day;

    this.fechaInicioInventario = formattedDate
  }

  cancelSelectedItem() {
    this.selectedProducto = null
  }

  onFinalizarPlanilla() {
    Swal.fire({
      title: '¿Está seguro de finalizar la planilla?',
      text: '¡Si no lo está puede cancelar la acción!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      cancelButtonText: 'Cancelar',
      confirmButtonText: 'Si, finalizar planilla!',
    }).then((result) => {
      if (result.value) {

        localStorage.setItem('finalizarPlanilla', 'true')
        this._socketService.emitSocket('firmar-planilla', { mesaId: localStorage.getItem('mesa') })

        this.onValidateFirmas()
        this.openModalSing()

      }
    })
  }

  backInicio() {
    this._socketService.emitSocket('unsubscribe-room', { mesaId: localStorage.getItem('mesa') })
    localStorage.clear()
  }

  openModalSing() {

    const data = localStorage.getItem('finalizarPlanilla')
    if (data === 'true') {
      this.myModal.show();
    }

  }

  closedModalSing() {

    this.myModal.hide();
  }

  openDiferencia() {

    const data = localStorage.getItem('diferencia')
    if (data === 'true') {
      this.diferencia = true
      Swal.fire({
        title: 'Discrepancia Detectada',
        text: 'Por favor, corrige la discrepancia',
        icon: 'warning',
        confirmButtonText: 'Aceptar',
      });
    }

  }

  campoEsInvalido(campo: string): boolean {
    const control = this.miFormulario.get(campo);
    return control!.touched && control!.invalid;
  }

  OnSubmitConteo() {

    let data = {
      ...this.miFormulario.value,
      planilla: localStorage.getItem('planilla'),
      bodega: localStorage.getItem('bodega'),
      mesa: localStorage.getItem('mesa'),
      producto: this.selectedProducto._id,
      colaborador: this.colaboradorData._id,
      conteo: this.conteoData._id
    }

    this._conteoService.PostDiferencia(data).subscribe(
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
          text: 'Conteo registrada con éxito'
        });

        this.miFormulario.reset()
        this.diferencia = false
        this.selectedProducto = null
        this.onGetPlanilla()
        this.onGetConteo()
        this.itemsData = []
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
              title: body.body.message,
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
    this.miFormulario.reset()
  }

  onGetPlanillaResumen() {

    let planillaId = localStorage.getItem('planilla');

    this._planillasService.GetResumenTotal(planillaId).subscribe(
      (response) => {
        this.dataResumenInventario = response.body;
      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {

            this.dataResumenInventario = [];

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

  onGetEventosPlanilla() {
    let planilla_id = localStorage.getItem('planilla');
    let mesaId = localStorage.getItem('mesa');

    this._planillasService.GetEventPlanilla(planilla_id, mesaId).subscribe(
      (response) => {
        response.body.map((item: any) => {


          if (item.nombreEvento === "Firmar") {
            localStorage.setItem('finalizarPlanilla', 'true')
            this.onValidateFirmas()
            this.openModalSing()
          }

          if (item.nombreEvento === "Diferencia") {
            this.diferencia = true
            localStorage.setItem('diferencia', 'true')
            this.openDiferencia()
          }


        })

      },
      (error) => {
        var errorMessage = <any>error;

        if (errorMessage != null) {
          var body = error.error;

          if (error.status == 404) {



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

  clickCorregir(item: any) {
    console.log(item)
    this.pesajeCorregir = item
  }

  onSubmitCorregir() {
    this.btnStatusSubmitCorregir = true
    let data = {
      ...this.miFormulario.value,
      planilla: this.pesajeCorregir.planilla,
      conteo: this.pesajeCorregir._id,
      producto: this.selectedProducto._id,
      colaborador: this.colaboradorData._id,
    }
    this._conteoService.PostCorreccion(data).subscribe(
      (response) => {
        this.btnStatusSubmitCorregir = false
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
          text: 'Conteo registrada con éxito'
        });
        this.pesajeCorregir = null
        this.miFormulario.reset()
        this.diferencia = false
        this.selectedProducto = null
        this.onGetPlanilla()
        this.onGetConteo()
        this.itemsData = []
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
              title: body.body.message,
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

  cancelarCorreccion() {
    this.miFormulario.reset()
    this.selectedProducto = null
    this.pesajeCorregir = null
    this.itemsData = []
  }

}
