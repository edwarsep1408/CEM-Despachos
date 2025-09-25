import { TestBed } from '@angular/core/testing';

import { ValidarBodegaMesaService } from './validar-bodega-mesa.service';

describe('ValidarBodegaMesaService', () => {
  let service: ValidarBodegaMesaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ValidarBodegaMesaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
