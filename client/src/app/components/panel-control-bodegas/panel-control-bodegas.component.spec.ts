import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PanelControlBodegasComponent } from './panel-control-bodegas.component';

describe('PanelControlBodegasComponent', () => {
  let component: PanelControlBodegasComponent;
  let fixture: ComponentFixture<PanelControlBodegasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PanelControlBodegasComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PanelControlBodegasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
