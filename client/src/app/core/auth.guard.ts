import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);

  if (localStorage.getItem("token")) {
    return true;
  }

  const url = state?.url || "";
  const login = url.startsWith("/portal-conductor") ? "/login-conductor" : "/login";
  const next =
    url && url !== "/login" && url !== "/login-conductor" ? `?next=${encodeURIComponent(url)}` : "";
  return router.parseUrl(`${login}${next}`);
};
