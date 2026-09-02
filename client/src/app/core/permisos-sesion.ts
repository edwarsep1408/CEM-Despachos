export const RUTAS_POR_PERMISO: { codigo: string; ruta: string }[] = [
  { codigo: "dashboard.ver", ruta: "/configuracion/dashboard" },
  { codigo: "despacho.pedidos", ruta: "/configuracion/despacho/pedidos" },
  { codigo: "despacho.reaprovisionamiento", ruta: "/configuracion/despacho/reaprovisionamiento" },
  { codigo: "despacho.cargues", ruta: "/configuracion/despacho/cargues" },
  { codigo: "despacho.estado-cargues", ruta: "/configuracion/despacho/estado-cargues" },
  { codigo: "despacho.asignacion-bodega", ruta: "/configuracion/despacho/asignacion-bodega" },
  { codigo: "despacho.muelles", ruta: "/configuracion/despacho/muelles" },
  { codigo: "vehiculos.ver", ruta: "/configuracion/vehiculos" },
  { codigo: "despacho.firmantes", ruta: "/configuracion/firmantes" },
  { codigo: "despacho.hojas-ruta", ruta: "/configuracion/despacho/hojas-de-ruta" },
  { codigo: "despacho.ordenes-compra", ruta: "/configuracion/despacho/ordenes-de-compra" },
  { codigo: "despacho.motivos", ruta: "/configuracion/despacho/motivos-omision" },
  { codigo: "despacho.taras", ruta: "/configuracion/despacho/taras-empaques" },
  { codigo: "despacho.aviso", ruta: "/configuracion/despacho/aviso-despacho" },
  { codigo: "despacho.compromisos", ruta: "/configuracion/despacho/compromisos-pedidos" },
  { codigo: "despacho.piso", ruta: "/portal-despachador" },
  { codigo: "despacho.conductor", ruta: "/portal-conductor" },
  { codigo: "inventario.compania", ruta: "/configuracion/inventarioTotalCompania" },
  { codigo: "inventario.bodegas", ruta: "/configuracion/dashboardBodegas" },
  { codigo: "inventario.reportes", ruta: "/configuracion/reporteBodega" },
  { codigo: "inventario.gestionar", ruta: "/configuracion/gestionarInventario" },
  { codigo: "basculas.ver", ruta: "/configuracion/basculas" },
  { codigo: "items.ver", ruta: "/configuracion/items" },
  { codigo: "bodegas.ver", ruta: "/configuracion/bodegas" },
  { codigo: "mesas.ver", ruta: "/configuracion/mesas" },
  { codigo: "colaboradores.ver", ruta: "/configuracion/colaboradores" },
  { codigo: "seguridad.permisos", ruta: "/configuracion/permisos" },
  { codigo: "seguridad.perfiles", ruta: "/configuracion/perfiles" },
  { codigo: "seguridad.usuarios", ruta: "/configuracion/usuarios" },
];

export class PermisosSesion {
  static leer(): string[] | null {
    try {
      const raw = localStorage.getItem("permisos");
      if (raw === null) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return null;
    }
  }

  static guardar(identity: {
    nombre?: string;
    perfil?: string;
    permisos?: string[];
    puedeFirmar?: boolean;
  }) {
    if (Array.isArray(identity?.permisos)) {
      localStorage.setItem("permisos", JSON.stringify(identity.permisos));
    }
    if (identity?.perfil) {
      localStorage.setItem("perfil", identity.perfil);
    }
    if (identity?.puedeFirmar) localStorage.setItem("puedeFirmar", "1");
    else localStorage.removeItem("puedeFirmar");
  }

  static esConductor(): boolean {
    return localStorage.getItem("origen") === "conductor";
  }

  static esDespachador(): boolean {
    const perfil = String(localStorage.getItem("perfil") || "").toLowerCase();
    return perfil.includes("despachador") && !perfil.includes("admin");
  }

  static puedeFirmar(): boolean {
    return localStorage.getItem("puedeFirmar") === "1";
  }

  static tiene(codigo?: string): boolean {
    if (!codigo) return true;
    const permisos = this.leer();
    if (permisos === null) return true;
    return permisos.includes(codigo);
  }

  static tieneAlguno(codigos?: string[]): boolean {
    if (!codigos?.length) return true;
    return codigos.some((codigo) => this.tiene(codigo));
  }

  static primeraRuta(excepto?: string): string {
    if (this.esConductor()) {
      return "/portal-conductor";
    }
    if (this.esDespachador()) {
      return "/portal-despachador";
    }
    const permisos = this.leer();
    if (permisos !== null && !permisos.length && this.puedeFirmar()) {
      return "/mi-firma";
    }
    const candidatos = RUTAS_POR_PERMISO.filter(
      (item) => item.codigo !== excepto && item.codigo !== "despacho.piso" && item.codigo !== "despacho.conductor"
    );
    if (permisos === null) {
      return candidatos[0]?.ruta || "/configuracion/dashboard";
    }
    const hit = candidatos.find((item) => permisos.includes(item.codigo));
    if (hit) return hit.ruta;
    return this.puedeFirmar() ? "/mi-firma" : "/login";
  }

  static limpiar() {
    localStorage.removeItem("permisos");
    localStorage.removeItem("perfil");
    localStorage.removeItem("puedeFirmar");
    localStorage.removeItem("origen");
    localStorage.removeItem("placa");
  }
}
