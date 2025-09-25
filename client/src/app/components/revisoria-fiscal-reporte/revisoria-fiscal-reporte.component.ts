import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MaterialModule } from '../../material.module';
import { FormsModule } from '@angular/forms';
import { PlanillasService } from '../../services/planillas/planillas.service';
import { BodegasService } from '../../services/bodegas/bodegas.service';
import Swal from 'sweetalert2';
import $ from 'jquery';

@Component({
  selector: 'app-revisoria-fiscal-reporte',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: './revisoria-fiscal-reporte.component.html',
  styleUrl: './revisoria-fiscal-reporte.component.css',
})
export class RevisoriaFiscalReporteComponent {
  bodegas: any = [];
  fechasInventarioPorBodega: any = [];
  bodegaSeleccionada: any = null;
  inventarioSeleccionado: any = {};
  isButtonEnabled: boolean = false;

  constructor(
    private planillaService: PlanillasService,
    private bodegaService: BodegasService
  ) {
    this.consultarBodegas();
  }

  consultarBodegas() {
    console.log('consultando bodegas');

    this.bodegaService.Get().subscribe((resp) => {
      if (resp.body) {
        this.bodegas = resp.body;
      }
    });
  }

  OnGetFilter(event: Event) {
    this.isButtonEnabled = false;
    this.fechasInventarioPorBodega = [];
    const target = event.target as HTMLSelectElement;
    this.bodegaSeleccionada = target.value;
    this.planillaService
      .GetPlanillasPorBodega(this.bodegaSeleccionada)
      .subscribe((res) => {
        if (res.success) {
          console.log(res.success, 'FECHAS INVENTARIOS');
          this.fechasInventarioPorBodega = res.success;
        } else {
          Swal.fire({
            title: 'Error!',
            text: res.error,
            icon: 'info',
            confirmButtonText: 'Ok',
          });
        }
      });
  }

  GetPlanilla(event: Event) {
    this.isButtonEnabled = false;

    const target = event.target as HTMLSelectElement;

    const selectedValues = target.options[target.selectedIndex];

    /* extraer el atributo data-coleccion que viene del option en la selección */
    const coleccion = selectedValues.getAttribute('data-coleccion');
    /* Se valida que la coleccion si tenga valores */
    if (coleccion) {
      /* se parsea el valor de vuelta a un objeto */
      this.inventarioSeleccionado = JSON.parse(coleccion);
    }

    if (this.inventarioSeleccionado) {
      /* validar que el select fecha si haya sido seleccionado */
      let planillaSelected = $('#planilla').val();

      if (planillaSelected) {
        console.log('Ingreso a habilirtar el btn');
        this.isButtonEnabled = planillaSelected !== '';
      } else {
        Swal.fire({
          title: '¿Has seleccionado una fecha?',
          text: 'Por favor seleccione una fecha para filtrar inventario',
          icon: 'info',
        });
      }
    }
  }

  filtarInventario() {
    this.planillaService
      .GetExcelInventarioRevisoriaFiscal(this.inventarioSeleccionado)
      .subscribe((resta) => {
        console.log(resta, '<-----------------------------------respuesta');
      });
  }

  compareFn = (a: any, b: any) => {
    return a._id === b._id;
  };

}
