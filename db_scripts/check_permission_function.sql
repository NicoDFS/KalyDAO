CREATE OR REPLACE FUNCTION check_table_insert_permission(table_name text) RETURNS boolean AS $$ BEGIN RAISE EXCEPTION 'ROLLBACK TRANSACTION'; RETURN false; END; $$ LANGUAGE plpgsql;
