import { Component } from "@angular/core";

@Component({
  selector: "app-piso-brand",
  standalone: true,
  template: `
    <span class="piso-brand" aria-label="CEM DESPACHOS">
      <img src="assets/img/LOGOTIPO.svg" alt="CEM" class="piso-brand-logo" />
      <span class="piso-brand-text">DESPACHOS</span>
    </span>
  `,
  styles: [
    `
      :host {
        float: right;
        margin: 0 4px 0 12px;
      }
      .piso-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        white-space: nowrap;
      }
      .piso-brand-logo {
        display: block;
        height: 36px;
        width: 84px;
        object-fit: cover;
        object-position: center;
      }
      .piso-brand-text {
        font-weight: 700;
        font-size: 18px;
        letter-spacing: 0.05em;
        color: #005cb9;
        font-style: italic;
        line-height: 1;
      }
      @media (max-width: 800px) {
        :host {
          float: none;
          display: flex;
          justify-content: flex-end;
          width: 100%;
          margin: 0 0 8px;
        }
        .piso-brand-logo {
          height: 30px;
          width: 70px;
        }
        .piso-brand-text {
          font-size: 16px;
        }
      }
    `,
  ],
})
export class PisoBrandComponent {}
