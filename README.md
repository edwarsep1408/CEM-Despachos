
# CEM-Despachos

**CEM-Despachos** es el sistema de gestión de despachos de Cárnicos y Alimentos: pedidos, cargues, piso, hojas de ruta, básculas y portal del conductor.

El sistema cuenta con:

- 🧩 **Frontend** desarrollado en **Angular v16.20.2**
- ⚙️ **Backend** en **Node.js** (**v18.0.0 o superior**)

---

## 📍 Roadmap

- ✅ Gestión de inventario
- ✅ Reporterías de inventario
- ✅ Gestión de ítems
- ✅ Reportes de existencias (compañía)
- ✅ Reportes por bodegas
- ✅ Integración de WebSockets

---

## 🧩 Estructura del Proyecto

```
cem-despachos/
├── client/                # Frontend (Angular)
│   ├── src/
│       └── app
│       └── assets
│       └── environments
│       └── index 
├── backend/               # Backend (Node.js)
│   ├── controllers
│   ├── routes 
│   └── cron
|   └── db 
|   └── middleware
|   └── models
|   └── routes
|   └── services
|   └── tmp
|   └── babel
|   └── index
└── README.md
```

---

## ⚙️ Instalación

1. Clona el repositorio:

```bash
git clone https://github.com/Carnicos-y-Alimentos/CEM-logistica.git
cd CEM-logistica
```

2. Instala y ejecuta el **Frontend**:

```bash
cd client
npm install
ng serve
```

3. Instala y ejecuta el **Backend**:

```bash
cd ../backend
npm install
npm run start
```

---

## 📦 Módulos del Sistema

### 🔄 Gestión de Inventario

Permite realizar el **inventario físico** en cada sede de la compañía (con conexión a internet). Los roles principales son:

| Rol          | Descripción |
|--------------|-------------|
| **Contador** | Digita los detalles de los conteos y firma al finalizar. |
| **Coordinador** | Abre planillas, corrige conteos y cierra inventarios. |
| **Administrador** | Gestiona usuarios, crea mesas, exporta reportes y visualiza gráficos e informes. |

---

### 📊 Reporterías de Inventario

Después de finalizar un inventario, los **administradores** pueden acceder a los reportes desde:

```
configuracion/reporteBodega
```

Pasos:
1. Seleccionar la bodega.
2. Seleccionar la fecha del inventario.
3. Hacer clic en el tipo de reporte deseado.

---

### 🛠 Gestión de Ítems

Permite actualizar la base de datos de ítems de forma manual por los administradores, para asegurar la precisión del inventario.

---

### 🏢 Reporte de Existencias por Compañía

Proporciona una **visión global** del estado del inventario de toda la compañía con apoyo de:

- Gráficas dinámicas
- Tablas interactivas
- Visualizaciones intuitivas

---

### 🏬 Reporte por Bodega

Ofrece reportes **detallados** para cada bodega, facilitando decisiones operativas en **tiempo real** con datos precisos y actualizados.

---

### 📡 WebSockets

Se implementó una conexión en **tiempo real** entre cliente y servidor para evitar inconsistencias durante los conteos. Si se detecta una diferencia entre usuarios contadores, el sistema:
- Notifica con una alerta en vivo.
- Detiene el proceso de conteo hasta resolver el conflicto.
- Mantiene sincronizada la información para todos los usuarios.

---


