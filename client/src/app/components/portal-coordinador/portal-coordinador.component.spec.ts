import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortalCoordinadorComponent } from './portal-coordinador.component';

describe('PortalCoordinadorComponent', () => {
  let component: PortalCoordinadorComponent;
  let fixture: ComponentFixture<PortalCoordinadorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortalCoordinadorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PortalCoordinadorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
