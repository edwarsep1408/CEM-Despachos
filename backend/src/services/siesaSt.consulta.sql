-- Connekta: carnicosyalimentos_carnicosyalimentos_documentos_ST
-- Pegar en la consulta. Cia 13. Sin @ ni ORDER BY. Sin sys.*.
--
-- Cruce real (t470 de ST 25924 vs ET 2417 rowid 8068076):
--   ET.f470_rowid_movto_transito_sal = ST.f470_rowid
--   ST motivo 21 / naturaleza 2 (salida). ET motivo 20 / naturaleza 1 (entrada).
--   t450 y t461 no existen. t350.f350_rowid_docto_base va null.
-- Saldo = cantidad ST menos lo ya recibido en ET (informe 10188).

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
    ABS(T470.f470_cant_1) - ISNULL((
        SELECT SUM(ABS(Y.f470_cant_1))
        FROM t470_cm_movto_invent AS Y
        WHERE Y.f470_id_cia = T470.f470_id_cia
          AND Y.f470_rowid_movto_transito_sal = T470.f470_rowid
    ), 0)                                                  AS cant_saldo_1,
    ABS(T470.f470_cant_2) - ISNULL((
        SELECT SUM(ABS(Y2.f470_cant_2))
        FROM t470_cm_movto_invent AS Y2
        WHERE Y2.f470_id_cia = T470.f470_id_cia
          AND Y2.f470_rowid_movto_transito_sal = T470.f470_rowid
    ), 0)                                                  AS cant_saldo_2
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
    ON T470E.f470_rowid_movto_transito_sal = T470.f470_rowid
LEFT JOIN t150_mc_bodegas AS ENT
    ON ENT.f150_rowid = T470E.f470_rowid_bodega
WHERE T470.f470_id_cia = 13
  AND RTRIM(T350.f350_id_tipo_docto) = 'ST'
  AND T350.f350_ind_estado <> 2
  AND T470.f470_id_fecha >= DATEFROMPARTS(YEAR(GETDATE()), 1, 1)
  AND T470.f470_id_fecha < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))
  AND (ISNULL(T470.f470_cant_1, 0) <> 0 OR ISNULL(T470.f470_cant_2, 0) <> 0)
  AND ABS(T470.f470_cant_1) - ISNULL((
        SELECT SUM(ABS(S1.f470_cant_1))
        FROM t470_cm_movto_invent AS S1
        WHERE S1.f470_id_cia = T470.f470_id_cia
          AND S1.f470_rowid_movto_transito_sal = T470.f470_rowid
      ), 0) > 0.0001
