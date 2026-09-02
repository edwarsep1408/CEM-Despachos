import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { Router } from '@angular/router'
import { catchError } from 'rxjs/operators';

@Injectable()
export class InjectSessionInterceptor implements HttpInterceptor {

  constructor(
    private _router: Router
  ) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isAuthRequest =
      request.url.includes('/post-login-local') ||
      request.url.includes('/post-login-conductor') ||
      request.url.includes('/post-validar-sesion');

    if (isAuthRequest) {
      return next.handle(request);
    }

    const token = localStorage.getItem('token');
    const newRequest = token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

    return next.handle(newRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 403 || error.status === 401) {
          const origen = localStorage.getItem("origen");
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          const url = this._router.url || "";
          const conductor =
            origen === "conductor" || url.includes("portal-conductor") || url.includes("login-conductor");
          this._router.navigate([conductor ? "/login-conductor" : "/login"]);
        }
        return throwError(() => error);
      })
    );
  }
}
