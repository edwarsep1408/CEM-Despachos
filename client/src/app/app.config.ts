import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { MatPaginatorIntlSpanish } from './config/MatPaginatorIntlSpanish';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes),
  { provide: MatPaginatorIntl, useClass: MatPaginatorIntlSpanish }
  ]
};
