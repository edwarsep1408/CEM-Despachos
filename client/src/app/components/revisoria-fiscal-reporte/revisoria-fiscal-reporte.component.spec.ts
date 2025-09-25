import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RevisoriaFiscalReporteComponent } from './revisoria-fiscal-reporte.component';

describe('RevisoriaFiscalReporteComponent', () => {
  let component: RevisoriaFiscalReporteComponent;
  let fixture: ComponentFixture<RevisoriaFiscalReporteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RevisoriaFiscalReporteComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RevisoriaFiscalReporteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
