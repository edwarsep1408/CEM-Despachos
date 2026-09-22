import { Component, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../material.module';
import { BodegasService } from '../../services/bodegas/bodegas.service';
import Chart from 'chart.js/auto';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-dashboard-indicadores',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './dashboard-indicadores.component.html',
  styleUrl: './dashboard-indicadores.component.css',
})
export class DashboardIndicadoresComponent implements AfterViewInit, OnDestroy {
  cargando = false;
  transitoCargando = false;
  private transitoEstable = false;
  data: any = null;
  private chartOcupacion: any = null;
  private chartParticipacion: any = null;
  private transitoTimer: ReturnType<typeof setTimeout> | null = null;
  private transitoIntentos = 0;

  constructor(private bodegas: BodegasService) {}

  ngAfterViewInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destruirCharts();
    this.limpiarTransitoTimer();
  }

  cargar(): void {
    this.cargando = true;
    this.limpiarTransitoTimer();
    this.transitoIntentos = 0;
    this.transitoEstable = false;
    this.bodegas.dashboardIndicadoresInventario().subscribe({
      next: (response) => {
        this.cargando = false;
        this.data = response.body || null;
        this.aplicarTransito(this.data);
        setTimeout(() => this.pintarCharts());
      },
      error: (error) => {
        this.cargando = false;
        Swal.fire({
          title: 'No se pudo armar el tablero',
          text: error?.error?.body?.message || 'Connekta no respondió el inventario.',
          icon: 'error',
        });
      },
    });
  }

  private aplicarTransito(body: any): void {
    if (!this.data) return;
    const transito = body?.transito || this.data.transito || {};
    const enCurso = Boolean(transito.enCurso);
    const redondearKg = (valor: number) => Math.round(Number(valor || 0) * 100) / 100;
    const kgTransito = redondearKg(Number(body?.kgTransito ?? body?.totales?.totalKgMovimiento ?? 0) || 0);
    const kgBodega = redondearKg(Number(this.data.kgBodega ?? this.data.kgTotales ?? 0) || 0);
    const undTransito = Number(body?.unidadesTransito ?? body?.totales?.totalUnidadesMovimiento ?? this.data.unidadesTransito ?? 0) || 0;
    const undBodega = Number(this.data.unidadesBodega ?? 0) || 0;
    const pintar = !enCurso || !this.transitoEstable;
    if (pintar) {
      this.data = {
        ...this.data,
        kgBodega,
        kgTransito,
        kgConTransito: redondearKg(kgBodega + kgTransito),
        unidadesBodega: Math.round(undBodega),
        unidadesTransito: Math.round(undTransito),
        unidadesConTransito: Math.round(undBodega + undTransito),
        transito,
      };
      this.transitoEstable = true;
    } else {
      this.data = { ...this.data, transito };
    }
    this.transitoCargando = enCurso;
    if (enCurso && this.transitoIntentos < 150) {
      this.programarRefrescoTransito();
    }
  }

  private programarRefrescoTransito(): void {
    this.limpiarTransitoTimer();
    this.transitoIntentos += 1;
    this.transitoTimer = setTimeout(() => this.consultarTransito(), 4000);
  }

  private consultarTransito(): void {
    this.bodegas.consultarInventarioTransito().subscribe({
      next: (response) => {
        if (response.body) this.aplicarTransito({
          kgTransito: response.body.totales?.totalKgMovimiento,
          unidadesTransito: response.body.totales?.totalUnidadesMovimiento,
          transito: response.body.transito,
        });
      },
      error: () => {
        if (this.transitoCargando && this.transitoIntentos < 150) {
          this.programarRefrescoTransito();
        }
      },
    });
  }

  private limpiarTransitoTimer(): void {
    if (this.transitoTimer) {
      clearTimeout(this.transitoTimer);
      this.transitoTimer = null;
    }
  }

  private destruirCharts(): void {
    this.chartOcupacion?.destroy();
    this.chartParticipacion?.destroy();
    this.chartOcupacion = null;
    this.chartParticipacion = null;
  }

  private pintarCharts(): void {
    if (!this.data) return;
    this.destruirCharts();
    const ocupacion = this.data.ocupacion || [];
    const canvasOcup = document.getElementById('chartOcupacionBodegas') as HTMLCanvasElement | null;
    if (canvasOcup) {
      this.chartOcupacion = new Chart(canvasOcup, {
        type: 'bar',
        data: {
          labels: ocupacion.map((item: any) => item.etiqueta),
          datasets: [
            {
              label: 'Capacidad',
              data: ocupacion.map((item: any) => item.capacidad),
              backgroundColor: 'rgba(147, 176, 211, 0.85)',
            },
            {
              label: 'Kg actuales',
              data: ocupacion.map((item: any) => item.kg),
              backgroundColor: 'rgba(15, 76, 140, 0.95)',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
          },
          layout: { padding: { top: 20 } },
          locale: 'es-CO',
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value: string | number) =>
                  Number(value).toLocaleString('es-CO', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  }),
              },
            },
          },
        },
        plugins: [
          {
            id: 'pctOcupacion',
            afterDatasetsDraw: (chart) => {
              const { ctx } = chart;
              const meta = chart.getDatasetMeta(1);
              meta.data.forEach((bar, i) => {
                const pct = ocupacion[i]?.porcentaje;
                if (!pct) return;
                ctx.save();
                ctx.fillStyle = pct > 100 ? '#c1121f' : '#0f4c8c';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`${pct}%`, bar.x, bar.y - 6);
                ctx.restore();
              });
            },
          },
        ],
      });
    }

    const paleta: Record<string, string> = {
      pollo_pt: '#0f4c8c',
      pollo_proceso: '#f0a202',
      carnes_frias: '#7eb8da',
    };
    const participacion = (this.data.participacion || []).filter((item: any) => item.kg > 0);
    const canvasPie = document.getElementById('chartParticipacionTipo') as HTMLCanvasElement | null;
    if (canvasPie) {
      this.chartParticipacion = new Chart(canvasPie, {
        type: 'pie',
        data: {
          labels: participacion.map((item: any) => item.etiqueta),
          datasets: [
            {
              data: participacion.map((item: any) => item.kg),
              backgroundColor: participacion.map((item: any) => paleta[item.id] || '#9da1af'),
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          locale: 'es-CO',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                generateLabels: (chart) => {
                  const dataset = chart.data.datasets[0];
                  return (chart.data.labels || []).map((label, i) => {
                    const item = participacion[i] || {};
                    return {
                      text: `${label} ${Number(item.kg || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${item.porcentaje || 0}%`,
                      fillStyle: Array.isArray(dataset.backgroundColor)
                        ? dataset.backgroundColor[i]
                        : dataset.backgroundColor,
                      hidden: false,
                      index: i,
                      datasetIndex: 0,
                    };
                  });
                },
              },
            },
          },
        },
      });
    }
  }
}
