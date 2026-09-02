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
import { authGuard } from './core/auth.guard';
import { permissionGuard } from './core/permission.guard';
import { PermisosComponent } from './components/permisos/permisos.component';
import { PerfilesComponent } from './components/perfiles/perfiles.component';
import { UsuariosComponent } from './components/usuarios/usuarios.component';

import { PedidosComponent } from './components/despacho/pedidos/pedidos.component';
import { ReaprovisionamientosComponent } from './components/despacho/reaprovisionamientos/reaprovisionamientos.component';
import { ReaprovisionamientoNuevoComponent } from './components/despacho/reaprovisionamiento-nuevo/reaprovisionamiento-nuevo.component';
import { ReaprovisionamientoDetalleComponent } from './components/despacho/reaprovisionamiento-detalle/reaprovisionamiento-detalle.component';
import { CarguesComponent } from './components/despacho/cargues/cargues.component';
import { EstadoCarguesComponent } from './components/despacho/estado-cargues/estado-cargues.component';
import { EstadoCargueDetalleComponent } from './components/despacho/estado-cargues/estado-cargue-detalle.component';
import { CargueNuevoComponent } from './components/despacho/cargue-nuevo/cargue-nuevo.component';
import { CargueDetalleComponent } from './components/despacho/cargue-detalle/cargue-detalle.component';
import { AsignacionBodegaComponent } from './components/asignacion-bodega/asignacion-bodega.component';
import { HojasDeRutaComponent } from './components/despacho/hojas-de-ruta/hojas-de-ruta.component';
import { HojaRutaNuevaComponent } from './components/despacho/hoja-ruta-nueva/hoja-ruta-nueva.component';
import { HojaRutaDetalleComponent } from './components/despacho/hoja-ruta-detalle/hoja-ruta-detalle.component';
import { OrdenesDeCompraComponent } from './components/despacho/ordenes-de-compra/ordenes-de-compra.component';
import { MotivosOmisionComponent } from './components/despacho/motivos-omision/motivos-omision.component';
import { TarasEmpaquesComponent } from './components/despacho/taras-empaques/taras-empaques.component';
import { AvisoDespachoComponent } from './components/despacho/aviso-despacho/aviso-despacho.component';
import { CompromisosPedidosComponent } from './components/despacho/compromisos-pedidos/compromisos-pedidos.component';
import { PisoDespachoComponent } from './components/despacho/piso-despacho/piso-despacho.component';
import { PortalDespachadorComponent } from './components/portal-despachador/portal-despachador.component';
import { PortalCarguesComponent } from './components/portal-despachador/portal-cargues.component';
import { PortalDocumentosComponent } from './components/portal-despachador/portal-documentos.component';
import { PortalLineasComponent } from './components/portal-despachador/portal-lineas.component';
import { PortalPesarComponent } from './components/portal-despachador/portal-pesar.component';
import { BasculasComponent } from './components/basculas/basculas.component';
import { MuellesComponent } from './components/muelles/muelles.component';
import { VehiculosComponent } from './components/vehiculos/vehiculos.component';
import { FirmantesComponent } from './components/firmantes/firmantes.component';
import { MiFirmaComponent } from './components/mi-firma/mi-firma.component';
import { LoginConductorComponent } from './login-conductor/login-conductor.component';
import { PortalConductorComponent } from './components/portal-conductor/portal-conductor.component';
import { PortalConductorHojaComponent } from './components/portal-conductor/portal-conductor-hoja.component';
import { PortalConductorFacturaComponent } from './components/portal-conductor/portal-conductor-factura.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'login-conductor', component: LoginConductorComponent },
  { path: 'mi-firma', component: MiFirmaComponent, canActivate: [authGuard] },
  { path: 'portal-contador/:bodega/:mesa', component: PortalContadorComponent },
  { path: 'portal-coordinador/:bodega/:mesa', component: PortalCoordinadorComponent },
  {
    path: 'portal-conductor',
    component: PortalConductorComponent,
    canActivate: [authGuard, permissionGuard],
    data: { permiso: 'despacho.conductor' },
    children: [
      { path: '', component: PortalConductorHojaComponent },
      { path: ':hojaId/:docId', component: PortalConductorFacturaComponent },
    ],
  },
  {
    path: 'portal-despachador',
    component: PortalDespachadorComponent,
    canActivate: [authGuard, permissionGuard],
    data: { permisos: ['despacho.piso', 'despacho.cargues'] },
    children: [
      { path: '', component: PortalCarguesComponent },
      { path: ':cargueId', component: PortalDocumentosComponent },
      { path: ':cargueId/:docId', component: PortalLineasComponent },
      { path: ':cargueId/:docId/:lineaId', component: PortalPesarComponent },
    ],
  },
  { path: 'gestionarInventario', component: VerificarBodegaComponent },
  {
    path: 'configuracion',
    canActivate: [authGuard],
    children: [
      { path: 'items', component: ItemsComponent, canActivate: [permissionGuard], data: { permiso: 'items.ver' } },
      { path: 'bodegas', component: BodegasComponent, canActivate: [permissionGuard], data: { permiso: 'bodegas.ver' } },
      { path: 'mesas', component: MesasComponent, canActivate: [permissionGuard], data: { permiso: 'mesas.ver' } },
      { path: 'colaboradores', component: PersonalComponent, canActivate: [permissionGuard], data: { permiso: 'colaboradores.ver' } },
      { path: 'planillas', component: PlanillasComponent },
      { path: 'dashboard', component: DashboardComponent, canActivate: [permissionGuard], data: { permiso: 'dashboard.ver' } },
      { path: 'reporteBodega', component: ReporteBodegaPlanillaComponent, canActivate: [permissionGuard], data: { permiso: 'inventario.reportes' } },
      { path: 'reporteRevosoriaFiscal', component: RevisoriaFiscalReporteComponent },
      { path: 'dashboardBodegas', component: PanelControlBodegasComponent, canActivate: [permissionGuard], data: { permiso: 'inventario.bodegas' } },
      { path: 'inventarioTotalCompania', component: InventarioTotalCompaniaComponent, canActivate: [permissionGuard], data: { permiso: 'inventario.compania' } },
      { path: 'gestionarInventario', component: VerificarBodegaComponent, canActivate: [permissionGuard], data: { permiso: 'inventario.gestionar' } },
      { path: 'basculas', component: BasculasComponent, canActivate: [permissionGuard], data: { permisos: ['basculas.ver', 'inventario.gestionar'] } },
      { path: 'despacho/muelles', component: MuellesComponent, canActivate: [permissionGuard], data: { permisos: ['despacho.muelles', 'basculas.ver', 'despacho.cargues'] } },
      { path: 'vehiculos', component: VehiculosComponent, canActivate: [permissionGuard], data: { permiso: 'vehiculos.ver' } },
      { path: 'firmantes', component: FirmantesComponent, canActivate: [permissionGuard], data: { permiso: 'despacho.firmantes' } },
      { path: 'despacho', redirectTo: 'despacho/pedidos', pathMatch: 'full' },
      { path: 'despacho/pedidos', component: PedidosComponent, canActivate: [permissionGuard], data: { permiso: 'despacho.pedidos' } },
      { path: 'despacho/reaprovisionamiento', component: ReaprovisionamientosComponent, canActivate: [permissionGuard], data: { permisos: ['despacho.reaprovisionamiento', 'despacho.pedidos', 'despacho.cargues'] } },
      { path: 'despacho/reaprovisionamiento/nuevo', component: ReaprovisionamientoNuevoComponent, canActivate: [permissionGuard], data: { permisos: ['despacho.reaprovisionamiento', 'despacho.pedidos', 'despacho.cargues'] } },
      { path: 'despacho/reaprovisionamiento/:id', component: ReaprovisionamientoDetalleComponent, canActivate: [permissionGuard], data: { permisos: ['despacho.reaprovisionamiento', 'despacho.pedidos', 'despacho.cargues'] } },
      { path: 'despacho/cargues', component: CarguesComponent, canActivate: [permissionGuard], data: { permiso: 'despacho.cargues' } },
      { path: 'despacho/cargues/nuevo', component: CargueNuevoComponent, canActivate: [permissionGuard], data: { permiso: 'despacho.cargues' } },
      { path: 'despacho/cargues/:id', component: CargueDetalleComponent, canActivate: [permissionGuard], data: { permiso: 'despacho.cargues' } },
      { path: 'despacho/estado-cargues', component: EstadoCarguesComponent, canActivate: [permissionGuard], data: { permisos: ['despacho.estado-cargues', 'despacho.cargues'] } },
      { path: 'despacho/estado-cargues/:id', component: EstadoCargueDetalleComponent, canActivate: [permissionGuard], data: { permisos: ['despacho.estado-cargues', 'despacho.cargues'] } },
      { path: 'despacho/asignacion-bodega', component: AsignacionBodegaComponent, canActivate: [permissionGuard], data: { permisos: ['despacho.asignacion-bodega', 'despacho.cargues', 'seguridad.usuarios'] } },
      { path: 'despacho/hojas-de-ruta', component: HojasDeRutaComponent, canActivate: [permissionGuard], data: { permiso: 'despacho.hojas-ruta' } },
      { path: 'despacho/hojas-de-ruta/nueva', component: HojaRutaNuevaComponent, canActivate: [permissionGuard], data: { permiso: 'despacho.hojas-ruta' } },
      { path: 'despacho/hojas-de-ruta/:id', component: HojaRutaDetalleComponent, canActivate: [permissionGuard], data: { permiso: 'despacho.hojas-ruta' } },
      { path: 'despacho/ordenes-de-compra', component: OrdenesDeCompraComponent, canActivate: [permissionGuard], data: { permiso: 'despacho.ordenes-compra' } },
      { path: 'despacho/motivos-omision', component: MotivosOmisionComponent, canActivate: [permissionGuard], data: { permiso: 'despacho.motivos' } },
      { path: 'despacho/taras-empaques', component: TarasEmpaquesComponent, canActivate: [permissionGuard], data: { permiso: 'despacho.taras' } },
      { path: 'despacho/aviso-despacho', component: AvisoDespachoComponent, canActivate: [permissionGuard], data: { permiso: 'despacho.aviso' } },
      { path: 'despacho/compromisos-pedidos', component: CompromisosPedidosComponent, canActivate: [permissionGuard], data: { permiso: 'despacho.compromisos' } },
      { path: 'despacho/piso', component: PisoDespachoComponent, canActivate: [permissionGuard], data: { permiso: 'despacho.piso' } },
      { path: 'permisos', component: PermisosComponent, canActivate: [permissionGuard], data: { permiso: 'seguridad.permisos' } },
      { path: 'perfiles', component: PerfilesComponent, canActivate: [permissionGuard], data: { permiso: 'seguridad.perfiles' } },
      { path: 'usuarios', component: UsuariosComponent, canActivate: [permissionGuard], data: { permiso: 'seguridad.usuarios' } },
    ],
    component: LayoutComponent
  }];


@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})

export class AppRoutingModule { }

