import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

/* LAYOUT  */

import { LayoutComponent } from "./layout/layout.component";

/* COMPONENTS */

import { VerificarBodegaComponent } from "./components/verificar-bodega/verificar-bodega.component";

import { ItemsComponent } from "./components/items/items.component";
import { BodegasComponent } from "./components/bodegas/bodegas.component";
import { MesasComponent } from "./components/mesas/mesas.component";
import { PersonalComponent } from "./components/personal/personal.component";
import { PortalContadorComponent } from "./components/portal-contador/portal-contador.component";
import { PortalCoordinadorComponent } from "./components/portal-coordinador/portal-coordinador.component";
import { PlanillasComponent } from "./components/planillas/planillas.component";
import { DashboardComponent } from "./components/dashboard/dashboard.component";
import { ReporteBodegaPlanillaComponent } from './components/reporte-bodega-planilla/reporte-bodega-planilla.component';
import { RevisoriaFiscalReporteComponent } from './components/revisoria-fiscal-reporte/revisoria-fiscal-reporte.component';
import { PanelControlBodegasComponent } from './components/panel-control-bodegas/panel-control-bodegas.component';
import { InventarioTotalCompaniaComponent } from './components/inventario-total-compania/inventario-total-compania.component';
import { LoginComponent } from './login/login.component';

export const routes: Routes = [
  { path: '', component: VerificarBodegaComponent },
  { path: 'login', component: LoginComponent },
  { path: 'portal-contador/:bodega/:mesa', component: PortalContadorComponent },
  { path: 'portal-coordinador/:bodega/:mesa', component: PortalCoordinadorComponent },
  { path: 'gestionarInventario', component: VerificarBodegaComponent },
  {
    path: 'configuracion',
    children: [
      { path: 'items', component: ItemsComponent },
      { path: 'bodegas', component: BodegasComponent },
      { path: 'mesas', component: MesasComponent },
      { path: 'colaboradores', component: PersonalComponent },
      { path: 'planillas', component: PlanillasComponent },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'reporteBodega', component: ReporteBodegaPlanillaComponent },
      { path: 'reporteRevosoriaFiscal', component: RevisoriaFiscalReporteComponent },
      { path: 'dashboardBodegas', component: PanelControlBodegasComponent },
      { path: 'inventarioTotalCompania', component: InventarioTotalCompaniaComponent },
    ],
    component: LayoutComponent
  }];


@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})

export class AppRoutingModule { }

