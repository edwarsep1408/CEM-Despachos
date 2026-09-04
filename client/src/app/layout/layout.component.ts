import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { filter } from 'rxjs/operators';
import { PermisosSesion } from '../core/permisos-sesion';
import { SesionService } from '../services/sesion/sesion.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  permiso?: string;
  permisos?: string[];
  soloFirmante?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
  match: (url: string) => boolean;
}

const RUTAS_CATALOGO_CONFIG = [
  "/configuracion/despacho/motivos-omision",
  "/configuracion/despacho/taras-empaques",
  "/configuracion/despacho/asignacion-bodega",
  "/configuracion/despacho/muelles",
  "/configuracion/basculas",
];

const esCatalogoConfig = (url: string) =>
  RUTAS_CATALOGO_CONFIG.some((ruta) => url.includes(ruta));

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent implements OnInit {
  private router = inject(Router);
  private breakpointObserver = inject(BreakpointObserver);
  private sesion = inject(SesionService);

  isSidebarCollapsed = signal(false);
  isSidebarHovered = signal(false);
  openMenus = signal<Record<string, boolean>>({});
  activeMenus = signal<Record<string, boolean>>({});
  identity = localStorage.getItem('user') || 'Usuario';
  perfilNombre = localStorage.getItem('perfil') || 'Usuario';
  inicioRuta = PermisosSesion.primeraRuta();

  showLabels = computed(
    () => !this.isSidebarCollapsed() || this.isSidebarHovered()
  );

  grupos: NavGroup[] = [
    {
      id: 'despacho',
      label: 'Despachos',
      icon: 'bxs-truck',
      match: (url) =>
        (url.includes('/configuracion/despacho') && !esCatalogoConfig(url)) ||
        url.includes('/portal-despachador'),
      items: [
        { label: 'Pedidos', icon: 'bx-clipboard', route: '/configuracion/despacho/pedidos', permiso: 'despacho.pedidos' },
        { label: 'Reaprovisionamiento CEDIS', icon: 'bx-transfer', route: '/configuracion/despacho/reaprovisionamiento', permisos: ['despacho.reaprovisionamiento', 'despacho.pedidos', 'despacho.cargues'] },
        { label: 'Cargues', icon: 'bx-package', route: '/configuracion/despacho/cargues', permiso: 'despacho.cargues' },
        { label: 'Estado de cargues', icon: 'bx-bar-chart-alt-2', route: '/configuracion/despacho/estado-cargues', permisos: ['despacho.estado-cargues', 'despacho.cargues'] },
        { label: 'Hojas de ruta', icon: 'bx-map-alt', route: '/configuracion/despacho/hojas-de-ruta', permiso: 'despacho.hojas-ruta' },
        { label: 'Órdenes de compra', icon: 'bx-file', route: '/configuracion/despacho/ordenes-de-compra', permiso: 'despacho.ordenes-compra' },
        { label: 'Aviso de despacho', icon: 'bx-broadcast', route: '/configuracion/despacho/aviso-despacho', permiso: 'despacho.aviso' },
        { label: 'Enviar compromisos', icon: 'bx-send', route: '/configuracion/despacho/compromisos-pedidos', permiso: 'despacho.compromisos' },
        { label: 'Piso despacho', icon: 'bx-barcode', route: '/portal-despachador', permiso: 'despacho.piso' },
      ],
    },
    {
      id: 'inventario',
      label: 'Inventario',
      icon: 'bx-cube',
      match: (url) =>
        url.includes('/configuracion/inventarioTotalCompania') ||
        url.includes('/configuracion/dashboardBodegas') ||
        url.includes('/configuracion/items') ||
        url.includes('/configuracion/bodegas'),
      items: [
        { label: 'Inventario compañía', icon: 'bx-building', route: '/configuracion/inventarioTotalCompania', permiso: 'inventario.compania' },
        { label: 'Inventario bodegas', icon: 'bx-grid-alt', route: '/configuracion/dashboardBodegas', permiso: 'inventario.bodegas' },
        { label: 'Items', icon: 'bx-list-ul', route: '/configuracion/items', permiso: 'items.ver' },
        { label: 'Bodegas', icon: 'bx-home', route: '/configuracion/bodegas', permiso: 'bodegas.ver' },
      ],
    },
    {
      id: 'inventario-fisico',
      label: 'Inventario físico',
      icon: 'bx-check-square',
      match: (url) =>
        url.includes('/configuracion/gestionarInventario') ||
        url.includes('/configuracion/reporteBodega'),
      items: [
        { label: 'Inventario', icon: 'bx-check-square', route: '/configuracion/gestionarInventario', permiso: 'inventario.gestionar' },
        { label: 'Reporte de inventarios físicos', icon: 'bx-spreadsheet', route: '/configuracion/reporteBodega', permiso: 'inventario.reportes' },
      ],
    },
    {
      id: 'configuracion',
      label: 'Configuración',
      icon: 'bx-cog',
      match: (url) =>
        url.includes('/configuracion/permisos') ||
        url.includes('/configuracion/perfiles') ||
        url.includes('/configuracion/usuarios') ||
        esCatalogoConfig(url) ||
        url.includes('/configuracion/vehiculos') ||
        url.includes('/configuracion/firmantes') ||
        url.includes('/configuracion/mesas') ||
        url.includes('/configuracion/colaboradores'),
      items: [
        { label: 'Permisos', icon: 'bx-lock-alt', route: '/configuracion/permisos', permiso: 'seguridad.permisos' },
        { label: 'Perfiles', icon: 'bx-id-card', route: '/configuracion/perfiles', permiso: 'seguridad.perfiles' },
        { label: 'Usuarios', icon: 'bx-user', route: '/configuracion/usuarios', permiso: 'seguridad.usuarios' },
        { label: 'Asignación de bodega', icon: 'bx-home-circle', route: '/configuracion/despacho/asignacion-bodega', permisos: ['despacho.asignacion-bodega', 'despacho.cargues', 'seguridad.usuarios'] },
        { label: 'Muelles', icon: 'bx-dock-top', route: '/configuracion/despacho/muelles', permisos: ['despacho.muelles', 'basculas.ver', 'despacho.cargues'] },
        { label: 'Básculas', icon: 'bx-tachometer', route: '/configuracion/basculas', permisos: ['basculas.ver', 'inventario.gestionar'] },
        { label: 'Motivos de omisión', icon: 'bx-block', route: '/configuracion/despacho/motivos-omision', permiso: 'despacho.motivos' },
        { label: 'Taras o empaques', icon: 'bx-box', route: '/configuracion/despacho/taras-empaques', permiso: 'despacho.taras' },
        { label: 'Vehículos', icon: 'bxs-truck', route: '/configuracion/vehiculos', permiso: 'vehiculos.ver' },
        { label: 'Firmantes', icon: 'bx-pen', route: '/configuracion/firmantes', permiso: 'despacho.firmantes' },
        { label: 'Mesas', icon: 'bx-table', route: '/configuracion/mesas', permiso: 'mesas.ver' },
        { label: 'Colaboradores', icon: 'bx-group', route: '/configuracion/colaboradores', permiso: 'colaboradores.ver' },
      ],
    },
  ];

  mainItems: NavItem[] = [
    { label: 'Dashboard', icon: 'bxs-dashboard', route: '/configuracion/dashboard', permiso: 'dashboard.ver' },
    { label: 'Mi firma', icon: 'bx-pen', route: '/mi-firma', soloFirmante: true },
  ];

  gruposVisibles: Array<Omit<NavGroup, 'match'>> = [];
  mainVisibles: NavItem[] = [];

  private visible(item: NavItem) {
    if (item.soloFirmante) return PermisosSesion.puedeFirmar();
    if (item.permisos?.length) return PermisosSesion.tieneAlguno(item.permisos);
    return PermisosSesion.tiene(item.permiso);
  }

  ngOnInit(): void {
    this.mainVisibles = this.mainItems.filter((item) => this.visible(item));
    this.gruposVisibles = this.grupos
      .map((group) => ({
        id: group.id,
        label: group.label,
        icon: group.icon,
        items: group.items.filter((item) => this.visible(item)),
      }))
      .filter((group) => group.items.length);

    const savedState = localStorage.getItem('cyaSidebarCollapsed');
    if (savedState === 'true') {
      this.isSidebarCollapsed.set(true);
    }

    this.syncMenus(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.syncMenus(event.urlAfterRedirects));

    this.breakpointObserver
      .observe([Breakpoints.Handset])
      .subscribe((result) => {
        if (result.matches) {
          this.isSidebarCollapsed.set(true);
        }
      });
  }

  syncMenus(url: string) {
    const active: Record<string, boolean> = {};
    const open: Record<string, boolean> = {};
    for (const group of this.grupos) {
      const isActive = group.match(url);
      active[group.id] = isActive;
      open[group.id] = isActive;
    }
    this.activeMenus.set(active);
    this.openMenus.set(open);
  }

  isGroupOpen(id: string) {
    return Boolean(this.openMenus()[id]);
  }

  isGroupActive(id: string) {
    return Boolean(this.activeMenus()[id]);
  }

  toggleGroup(id: string, event: Event) {
    event.preventDefault();
    if (this.isSidebarCollapsed()) {
      this.isSidebarCollapsed.set(false);
      localStorage.setItem('cyaSidebarCollapsed', 'false');
    }
    const willOpen = !this.openMenus()[id];
    const next: Record<string, boolean> = {};
    for (const group of this.grupos) {
      next[group.id] = willOpen && group.id === id;
    }
    this.openMenus.set(next);
  }

  trackGroup(_index: number, group: { id: string }) {
    return group.id;
  }

  trackItem(_index: number, item: NavItem) {
    return item.route;
  }

  toggleSidebar() {
    this.isSidebarCollapsed.update((collapsed) => {
      const next = !collapsed;
      localStorage.setItem('cyaSidebarCollapsed', String(next));
      return next;
    });
  }

  onMouseEnter() {
    this.isSidebarHovered.set(true);
  }

  onMouseLeave() {
    this.isSidebarHovered.set(false);
  }

  logout(event?: Event) {
    event?.preventDefault();
    this.sesion.cerrarSesion();
    this.router.navigate(['/login']);
  }
}
