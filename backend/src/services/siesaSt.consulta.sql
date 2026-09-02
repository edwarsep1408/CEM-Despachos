-- Connekta: carnicosyalimentos_carnicosyalimentos_documentos_ST
-- Producción v3, misma conexión de existencias.
-- Fechas EN el SQL (1 ene del año en curso → hoy). Sin @variables:
-- Connekta v3 de esta consulta aún no declara parámetros.
-- Sin ORDER BY.

SELECT
    RTRIM(T350.f350_id_tipo_docto)                         AS tipo_docto,
    T350.f350_consec_docto                                 AS consec_docto,
    CONVERT(VARCHAR, T470.f470_id_fecha, 23)               AS fecha,
    RTRIM(ISNULL(T350.f350_notas, ''))                     AS notas,
    RTRIM(T120.f120_referencia)                            AS referencia_item,
    RTRIM(T120.f120_descripcion)                           AS descripcion_item,
    RTRIM(T120.f120_descripcion)                           AS descripcion,
    RTRIM(SAL.f150_id)                                     AS codigo_bodega_sal,
    RTRIM(ISNULL(SAL.f150_descripcion, ''))                AS bodega_sal,
    RTRIM(ISNULL(ENT.f150_id, ''))                         AS codigo_bodega_ent,
    RTRIM(ISNULL(ENT.f150_descripcion, ''))                AS bodega_ent,
    ABS(T470.f470_cant_1)                                  AS cant_salida,
    ABS(T470.f470_cant_1)                                  AS cant_saldo_1,
    ABS(T470.f470_cant_2)                                  AS cant_saldo_2
FROM t470_cm_movto_invent AS T470
INNER JOIN t350_co_docto_contable AS T350
    ON T350.f350_rowid = T470.f470_rowid_docto
   AND T350.f350_id_cia = T470.f470_id_cia
INNER JOIN t121_mc_items_extensiones AS T121
    ON T121.f121_rowid = T470.f470_rowid_item_ext
   AND T121.f121_id_cia = T470.f470_id_cia
INNER JOIN t120_mc_items AS T120
    ON T120.f120_rowid = T121.f121_rowid_item
   AND T120.f120_id_cia = T121.f121_id_cia
LEFT JOIN t150_mc_bodegas AS SAL
    ON SAL.f150_rowid = T470.f470_rowid_bodega
LEFT JOIN t470_cm_movto_invent AS T470E
    ON T470E.f470_rowid_docto = T470.f470_rowid_docto
   AND T470E.f470_id_cia = T470.f470_id_cia
   AND T470E.f470_rowid_item_ext = T470.f470_rowid_item_ext
   AND T470E.f470_rowid_bodega <> T470.f470_rowid_bodega
LEFT JOIN t150_mc_bodegas AS ENT
    ON ENT.f150_rowid = T470E.f470_rowid_bodega
WHERE T470.f470_id_cia = 13
  AND RTRIM(T350.f350_id_tipo_docto) = 'ST'
  AND T350.f350_ind_estado <> 2
  AND T470.f470_id_fecha >= DATEFROMPARTS(YEAR(GETDATE()), 1, 1)
  AND T470.f470_id_fecha < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
  AND (ISNULL(T470.f470_cant_1, 0) <> 0 OR ISNULL(T470.f470_cant_2, 0) <> 0)
  AND T470.f470_rowid_bodega = (
        SELECT MIN(X.f470_rowid_bodega)
        FROM t470_cm_movto_invent AS X
        WHERE X.f470_rowid_docto = T470.f470_rowid_docto
          AND X.f470_id_cia = T470.f470_id_cia
          AND X.f470_rowid_item_ext = T470.f470_rowid_item_ext
      )
