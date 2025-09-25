import { Component } from '@angular/core';
import { PlanillasService } from '../../services/planillas/planillas.service';
import { BodegasService } from '../../services/bodegas/bodegas.service';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';

import Swal from 'sweetalert2';
import $ from 'jquery';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-reporte-bodega-planilla',
  standalone: true,
  imports: [CommonModule,MaterialModule, FormsModule],
  templateUrl: './reporte-bodega-planilla.component.html',
  styleUrl: './reporte-bodega-planilla.component.css'
})
export class ReporteBodegaPlanillaComponent {

  /* RV Hace referencia Revisoria Fiscal */

  bodegas: any = [];
  fechasInventarioPorBodega : any=[];
  bodegaSeleccionada : any = null;
  inventarioSeleccionado : any = {};
  isButtonEnabled: boolean= false;
  isButtonEnabledRF: boolean= false;
  isButtonEnabledDetallado: boolean= false;

  constructor(private planillaService: PlanillasService, private bodegaService: BodegasService){

    this.consultarBodegas();
    
   /* EMPEZAR A LLAMAR SERVICIOS PARA HACER PETICIÓN AL BACK  */ 

  }


  consultarBodegas(){
    this.bodegaService.Get().subscribe((resp) => {
      if (resp.body) {
        this.bodegas= resp.body;
      }  
    })
  }

  OnGetFilter(event: Event){

    this.isButtonEnabled=false;
    this.isButtonEnabledRF=false;
    this.isButtonEnabledDetallado=false;
    this.fechasInventarioPorBodega=[]
    const target= event.target as HTMLSelectElement;
    this.bodegaSeleccionada= target.value;
    this.planillaService.GetPlanillasPorBodega(this.bodegaSeleccionada).subscribe((res) => {
      
        if (res.success) {
          console.log(res.success, "FECHAS INVENTARIOS");
          this.fechasInventarioPorBodega = res.success;        
        }else{
          Swal.fire({
            title:'Error!',
            text: res.error,
            icon:'info',
            confirmButtonText:'Ok'
          })
        }

    });

  }

  GetPlanilla(event : Event){


    this.isButtonEnabled=false;
    this.isButtonEnabledRF=false;
    this.isButtonEnabledDetallado=false;
    const target=  event.target as HTMLSelectElement;
    
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

        if (planillaSelected){
          console.log("Ingreso a habilirtar el btn");
          this.isButtonEnabled = planillaSelected !== '';
          this.isButtonEnabledRF = planillaSelected!== '';
          this.isButtonEnabledDetallado = planillaSelected!== '';
        } else {
          Swal.fire({

            title:"¿Has seleccionado una fecha?",
            text: "Por favor seleccione una fecha para filtrar inventario",
            icon: "info"

          });
        }
      }
  }

  filtarInventario(){

    console.log(this.inventarioSeleccionado.fecha_formateada, "INFOBODEGA SELECCIONADA");
    
    this.planillaService.GetExcelInventario(this.inventarioSeleccionado).subscribe((resta) => {
      console.log(resta,"<-----------------------------------respuesta");
    });    

  }

  filtarInventarioRF(){
    
    console.log(this.inventarioSeleccionado.fecha_formateada, "INFOBODEGA SELECCIONADA REVISORIA FISCAL");
    
    this.planillaService.GetExcelInventarioRevisoriaFiscal(this.inventarioSeleccionado).subscribe((resta) => {
      
      console.log(resta,"<-----------------------------------respuesta");
    });
  }

  filtarInventarioDetallado(){

    this.planillaService.GetExcelInventario_por_mesayconteo(this.inventarioSeleccionado).subscribe((respta) => {

      console.log("respuesta inventario detallado ----->", respta );
      
    })
    console.log("INVENTARIO DETALLADO CLICk");
    


  }

  compareFn= (a:any , b: any) => {
    return a._id === b._id;
  }




  

}
