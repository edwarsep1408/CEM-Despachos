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
  data: any = null;
  private chartOcupacion: any = null;
  private chartParticipacion: any = null;

  constructor(private bodegas: BodegasService) {}

  ngAfterViewInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.destruirCharts();
  }

  cargar(): void {
    this.cargando = true;
    this.bodegas.dashboardIndicadoresInventario().subscribe({
      next: (response) => {
        this.cargando = false;
        this.data = response.body || null;
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
          scales: {
            y: { beginAtZero: true },
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
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                generateLabels: (chart) => {
                  const dataset = chart.data.datasets[0];
                  return (chart.data.labels || []).map((label, i) => {
                    const item = participacion[i] || {};
                    return {
                      text: `${label} ${Number(item.kg || 0).toLocaleString('es-CO')} · ${item.porcentaje || 0}%`,
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
