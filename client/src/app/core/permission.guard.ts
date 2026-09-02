import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { PermisosSesion } from "./permisos-sesion";

export const permissionGuard: CanActivateFn = (route) => {
  const varios = route.data?.["permisos"] as string[] | undefined;
  const codigo = route.data?.["permiso"] as string | undefined;
  const codigos = varios?.length ? varios : codigo ? [codigo] : [];
  if (!codigos.length || PermisosSesion.tieneAlguno(codigos)) {
    return true;
  }
  return inject(Router).parseUrl(PermisosSesion.primeraRuta(codigos[0]));
};
