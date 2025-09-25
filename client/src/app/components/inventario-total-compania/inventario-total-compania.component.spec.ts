import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InventarioTotalCompaniaComponent } from './inventario-total-compania.component';

describe('InventarioTotalCompaniaComponent', () => {
  let component: InventarioTotalCompaniaComponent;
  let fixture: ComponentFixture<InventarioTotalCompaniaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventarioTotalCompaniaComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InventarioTotalCompaniaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
