import { Component, OnInit, HostListener, Inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterModule, Router, RouterOutlet } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent implements OnInit {
  screenWidth: any;
  screenHeight: any;
  identity: any;

  constructor(@Inject(DOCUMENT) private document: Document) { }  // Inyecta DOCUMENT en el constructor

  ngOnInit(): void {
    this.getScreenSize();
    this.identity = null;
  }

  logout(){}

  // Resto del código...

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.getScreenSize(event);
  }

  getScreenSize(event?: any) {
    if (typeof window !== 'undefined') {  // Comprueba si window está definido
      this.screenWidth = window.innerWidth;
      this.screenHeight = window.innerHeight;

      // Puedes tomar decisiones basadas en las dimensiones de la pantalla aquí
      if (this.screenWidth < 768) {
        // Ejecutar código para pantallas pequeñas
      } else {
        // Ejecutar código para pantallas grandes
      }
    }
  }

  toggleSidebar() {
    if (typeof window !== 'undefined') {  // Comprueba si window está definido
      if (this.screenWidth <= 576) {
        const SIDEBAR_EL = this.document.getElementById("sidebar");

        if (SIDEBAR_EL !== null) {
          SIDEBAR_EL.classList.remove("collapsed");
          SIDEBAR_EL.classList.toggle("toggled");
        }
      } else {
        const SIDEBAR_EL = this.document.getElementById("sidebar");

        if (SIDEBAR_EL !== null) {
          SIDEBAR_EL.classList.toggle("collapsed");
        }
      }
    }
  }

  toggleOverlay() {
    if (typeof window !== 'undefined') {  // Comprueba si window está definido
      const SIDEBAR_EL = this.document.getElementById("sidebar");

      if (SIDEBAR_EL !== null) {
        SIDEBAR_EL.classList.toggle("toggled");
      }
    }
  }

}
