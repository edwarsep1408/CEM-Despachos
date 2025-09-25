import { TestBed } from '@angular/core/testing';

import { BodegasService } from './bodegas.service';

describe('BodegasService', () => {
  let service: BodegasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BodegasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
