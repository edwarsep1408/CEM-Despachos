-- Connekta: carnicosyalimentos_centros_costos
-- QA v3. Cia UnoEE: Cárnicos = 13, Incubación = 14.
-- t284 no tiene f284_rowid_tercero: responsable va vacío.
-- Sin @variables. Sin ORDER BY.

SELECT
    RTRIM(T284.f284_id)                         AS codigo,
    RTRIM(T284.f284_descripcion)                AS descripcion,
    T284.f284_ind_estado                        AS estado,
    CAST('' AS VARCHAR(20))                     AS responsable,
    RTRIM(ISNULL(T284.f284_id_co, ''))          AS id_centro_operativo,
    T284.f284_id_cia                            AS id_compania
FROM t284_co_ccosto AS T284
WHERE T284.f284_id_cia IN (13, 14)
