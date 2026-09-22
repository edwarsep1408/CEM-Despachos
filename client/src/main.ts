// main.ts
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { importProvidersFrom, LOCALE_ID } from '@angular/core';
import { RouterModule } from '@angular/router';
import { routes } from './app/app.routes';
import { provideAnimations } from '@angular/platform-browser/animations'
import { enableProdMode } from '@angular/core';
import { InjectSessionInterceptor } from "./app/core/inject-session.interceptor";
import { registerLocaleData } from '@angular/common';
import localeEsCO from '@angular/common/locales/es-CO';

import { environment } from './environments/environment';

import { SAVER, getSaver } from "./app/services/saver.provider";

registerLocaleData(localeEsCO);

if (environment.production) {
  enableProdMode();
}


bootstrapApplication(AppComponent, {
  providers: [
    { provide: LOCALE_ID, useValue: 'es-CO' },
    {provide: SAVER, useFactory: getSaver},
    {
      provide: HTTP_INTERCEPTORS,
      useClass: InjectSessionInterceptor,
      multi: true
  },
    importProvidersFrom(HttpClientModule, RouterModule.forRoot(routes)),
    provideAnimations()
],
}).catch(err => console.error(err));
