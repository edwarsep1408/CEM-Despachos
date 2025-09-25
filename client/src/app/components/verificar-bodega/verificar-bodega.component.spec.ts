import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VerificarBodegaComponent } from './verificar-bodega.component';

describe('VerificarBodegaComponent', () => {
  let component: VerificarBodegaComponent;
  let fixture: ComponentFixture<VerificarBodegaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerificarBodegaComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(VerificarBodegaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
