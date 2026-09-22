-- Connekta: carnicosyalimentos_existencias_por_bodega
-- Pegar en la consulta (reemplaza el SQL actual). Cia 13. Sin @ ni ORDER BY. Sin sys.*.
-- Parámetros Connekta (los que ya manda la app):
--   bodega = 009|tipoinventario =
--
-- El SQL viejo cruzaba t120.f120_id = f400_rowid_item_ext:
--   INNER JOIN cae filas (E11062 Montería, etc.)
--   o pega otro ítem (pernil 918 kg sale como AGNEXIN 5731).
-- Cruce correcto, el mismo de las ST:
--   t400.f400_rowid_item_ext = t121.f121_rowid
--   t121.f121_rowid_item    = t120.f120_rowid
-- Disponible ≈ 10017 Cant. disponible (existencia − comprometida).

SELECT
    RTRIM(BOD.f150_id)                                     AS IdBodega,
    RTRIM(ISNULL(BOD.f150_descripcion, ''))                AS NomBodega,
    T120.f120_rowid                                        AS IdItem,
    RTRIM(T120.f120_id)                                    AS codigo_item,
    RTRIM(T120.f120_referencia)                            AS Referencia,
    RTRIM(T120.f120_descripcion)                           AS DescItem,
    RTRIM(T120.f120_descripcion)                           AS descripcion,
    RTRIM(T120.f120_id_unidad_inventario)                  AS UN,
    RTRIM(T120.f120_id_unidad_inventario)                  AS unidad_medida_1,
    RTRIM(ISNULL(T120.f120_id_unidad_adicional, ''))       AS unidad_medida_2,
    RTRIM(BOD.f150_id)                                     AS codigo_bodega,
    RTRIM(ISNULL(BOD.f150_descripcion, ''))                AS descripcion_bodega,
    SUM(ISNULL(E.f400_cant_existencia_1, 0))               AS Existencia,
    SUM(ISNULL(E.f400_cant_comprometida_1, 0))             AS Comprometido,
    SUM(ISNULL(E.f400_cant_existencia_1, 0)
      - ISNULL(E.f400_cant_comprometida_1, 0))             AS Disponible,
    SUM(ISNULL(E.f400_cant_existencia_1, 0)
      - ISNULL(E.f400_cant_comprometida_1, 0))             AS existencia_1,
    SUM(ISNULL(E.f400_cant_existencia_2, 0)
      - ISNULL(E.f400_cant_comprometida_2, 0))             AS existencia_2,
    SUM(ISNULL(E.f400_cant_existencia_2, 0)
      - ISNULL(E.f400_cant_comprometida_2, 0))             AS Unidades
FROM t400_cm_existencia AS E
INNER JOIN t121_mc_items_extensiones AS T121
    ON T121.f121_rowid = E.f400_rowid_item_ext
   AND T121.f121_id_cia = E.f400_id_cia
INNER JOIN t120_mc_items AS T120
    ON T120.f120_rowid = T121.f121_rowid_item
   AND T120.f120_id_cia = T121.f121_id_cia
INNER JOIN t150_mc_bodegas AS BOD
    ON BOD.f150_rowid = E.f400_rowid_bodega
   AND BOD.f150_id_cia = E.f400_id_cia
WHERE E.f400_id_cia = 13
  AND RTRIM(BOD.f150_id) = '{bodega}'
  AND '{tipoinventario}' = '{tipoinventario}'
GROUP BY
    BOD.f150_id,
    BOD.f150_descripcion,
    T120.f120_rowid,
    T120.f120_id,
    T120.f120_referencia,
    T120.f120_descripcion,
    T120.f120_id_unidad_inventario,
    T120.f120_id_unidad_adicional
HAVING
    SUM(ISNULL(E.f400_cant_existencia_1, 0)
      - ISNULL(E.f400_cant_comprometida_1, 0)) <> 0
    OR SUM(ISNULL(E.f400_cant_existencia_2, 0)
      - ISNULL(E.f400_cant_comprometida_2, 0)) <> 0
