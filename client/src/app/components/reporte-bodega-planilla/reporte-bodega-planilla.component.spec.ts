import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReporteBodegaPlanillaComponent } from './reporte-bodega-planilla.component';

describe('ReporteBodegaPlanillaComponent', () => {
  let component: ReporteBodegaPlanillaComponent;
  let fixture: ComponentFixture<ReporteBodegaPlanillaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReporteBodegaPlanillaComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ReporteBodegaPlanillaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
