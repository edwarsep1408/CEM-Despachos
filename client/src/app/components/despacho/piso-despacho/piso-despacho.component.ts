import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-piso-despacho',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './piso-despacho.component.html',
  styleUrl: '../despacho-page.css',
})
export class PisoDespachoComponent {}
