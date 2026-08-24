CREATE OR REPLACE FUNCTION get_storage_stats(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_db_size BIGINT;
    v_company_rows BIGINT := 0;
    v_total_rows BIGINT := 0;
    v_estimate_mb FLOAT;
    v_result JSONB;
    v_table RECORD;
BEGIN
    -- 1. Tamanho total do banco de dados (bytes)
    SELECT pg_database_size(current_database()) INTO v_total_db_size;

    -- 2. Lista de tabelas que usam company_id para estimativa
    FOR v_table IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'company_id' 
        AND table_schema = 'public'
    LOOP
        EXECUTE format('SELECT count(*) FROM %I WHERE company_id = %L', v_table.table_name, p_company_id) INTO v_company_rows;
        v_total_rows := v_total_rows + v_company_rows;
    END LOOP;

    -- 3. Estimativa simplificada (baseada em ~1kb por registro médio)
    v_estimate_mb := (v_total_rows * 1024.0) / (1024.0 * 1024.0);

    v_result := jsonb_build_object(
        'total_db_size_bytes', v_total_db_size,
        'company_estimated_rows', v_total_rows,
        'company_estimated_mb', round(v_estimate_mb::numeric, 2),
        'server_status', 'Operational'
    );

    RETURN v_result;
END;
$$;
