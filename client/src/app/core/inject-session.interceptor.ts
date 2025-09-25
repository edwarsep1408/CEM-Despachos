import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router'
import { map } from 'rxjs/operators';

@Injectable()
export class InjectSessionInterceptor implements HttpInterceptor {

  constructor(
    private _router: Router
  ) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    try {

      let newRequest = request

      const token = localStorage.getItem('token');

      newRequest = request.clone(
        {
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        }
      )

      return next.handle(newRequest).pipe(map(event => {

        if (event instanceof HttpErrorResponse) {
          if (event['status'] === 403) {
            localStorage.removeItem('token');
            localStorage.clear();
            this._router.navigate(['/']);
          }
        }

        return event;
      }))

    }

    catch (e) {
      console.log('error', e)
      return next.handle(request);
    }
  }
}
