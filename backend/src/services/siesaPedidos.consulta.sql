-- Connekta QA: carnicosyalimentos_Detalle_pedidos_ventas (v3)
-- URL: https://serviciosqa.siesacloud.com/api/connekta/v3/ejecutarconsulta
--
-- Fechas por query (no literales):
--   parametros=fechaDesde = YYYY-MM-DD|fechaHasta = YYYY-MM-DD
-- Connekta sustituye {fechaDesde}/{fechaHasta} (sin comillas, sin CAST).
-- App: SIESA_PEDIDOS_USA_PARAMETROS=true

SELECT
    T430.f430_rowid                              AS id430,
    T430.f430_id_tipo_docto                      AS TipoDocPedido,
    T430.f430_consec_docto                       AS NumPedido,
    T430.f430_id_co                              AS COPedido,
    T431.f431_id_co_movto                        AS id_co_movto,
    T431.f431_id_un_movto                        AS Id_un_movto,
    RTRIM(T150.f150_id)                          AS Id_bodega,
    T150.f150_descripcion                        AS Desc_bodega,
    T430.f430_id_fecha                           AS FechaPedido,
    CONVERT(VARCHAR, T430.f430_id_fecha, 23)     AS Fecha,
    T430.f430_fecha_ts_actualizacion             AS FechaSync,
    T430.f430_fecha_ts_actualizacion             AS FechaActualizacion,
    T430.f430_fecha_ts_creacion                  AS Fecha_ts_creacion,
    T430.f430_ind_estado                         AS Ind_estado_pv,
    T431.f431_ind_estado                         AS Ind_estado_linea,
    RTRIM(CONVERT(VARCHAR(MAX), ISNULL(T430.f430_notas, ''))) AS notas_pedido,
    RTRIM(CONVERT(VARCHAR(MAX), ISNULL(T431.f431_notas, ''))) AS notas_linea,
    T200.f200_nit                                AS Nit,
    T200.f200_razon_social                       AS razon_social,
    T200.f200_nombre_est                         AS NombreEstablecimiento,
    T430.f430_id_sucursal_fact                   AS Id_sucursal_fact,
    VEN.f210_id                                  AS Vendedor,
    RTRIM(TVEN.f200_razon_social)                AS Desc_vendedor,
    T431.f431_rowid                              AS LineaRegistro,
    T120.f120_id                                 AS id_item,
    T120.f120_referencia                         AS [item referencia],
    T120.f120_descripcion                        AS [item descripcion],
    T431.f431_cant1_pedida                       AS cant1_pedida,
    T431.f431_cant2_pedida                       AS Unidades,
    T431.f431_id_unidad_medida                   AS id_unidad_medida,
    T431.f431_id_motivo                          AS id_motivo,
    T431.f431_id_lista_precio                    AS id_lista_precio,
    T431.f431_fecha_entrega                      AS Fecha_entrega,
    T431.f431_vlr_bruto                          AS vlr_bruto,
    T431.f431_vlr_neto                           AS vlr_neto
FROM dbo.t430_cm_pv_docto AS T430
INNER JOIN dbo.t431_cm_pv_movto AS T431
    ON T431.f431_rowid_pv_docto = T430.f430_rowid
   AND T431.f431_id_cia = T430.f430_id_cia
INNER JOIN dbo.t200_mm_terceros AS T200
    ON T430.f430_rowid_tercero_fact = T200.f200_rowid
   AND T200.f200_id_cia = T430.f430_id_cia
INNER JOIN dbo.t121_mc_items_extensiones AS T121
    ON T431.f431_rowid_item_ext = T121.f121_rowid
   AND T121.f121_id_cia = T431.f431_id_cia
INNER JOIN dbo.t120_mc_items AS T120
    ON T121.f121_rowid_item = T120.f120_rowid
   AND T120.f120_id_cia = T121.f121_id_cia
LEFT JOIN dbo.t150_mc_bodegas AS T150
    ON T150.f150_rowid = T431.f431_rowid_bodega
LEFT JOIN dbo.t210_mm_vendedores AS VEN
    ON T430.f430_rowid_tercero_vendedor = VEN.f210_rowid_tercero
   AND T430.f430_id_cia = VEN.f210_id_cia
LEFT JOIN dbo.t200_mm_terceros AS TVEN
    ON VEN.f210_rowid_tercero = TVEN.f200_rowid
   AND VEN.f210_id_cia = TVEN.f200_id_cia
WHERE T430.f430_id_cia = 13
  AND T431.f431_id_cia = 13
  AND T430.f430_id_tipo_docto IN ('PV', 'PVN', 'PVB', 'PVE', 'PVP', 'PVM')
  AND T430.f430_id_fecha >= {fechaDesde}
  AND T430.f430_id_fecha <= {fechaHasta}
