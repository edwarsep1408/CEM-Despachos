import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortalContadorComponent } from './portal-contador.component';

describe('PortalContadorComponent', () => {
  let component: PortalContadorComponent;
  let fixture: ComponentFixture<PortalContadorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortalContadorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PortalContadorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
