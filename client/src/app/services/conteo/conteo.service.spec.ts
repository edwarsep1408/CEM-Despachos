import { TestBed } from '@angular/core/testing';

import { ConteoService } from './conteo.service';

describe('ConteoService', () => {
  let service: ConteoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConteoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
