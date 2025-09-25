import { TestBed } from '@angular/core/testing';

import { PlanillasService } from './planillas.service';

describe('PlanillasService', () => {
  let service: PlanillasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlanillasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
