-- A generic trigger RECORD cannot safely access table-specific fields inside
-- a CASE expression. Branch first, then read the field available on that row.
CREATE OR REPLACE FUNCTION assert_ledger_transaction_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id UUID; entry_count BIGINT; debit_total NUMERIC; credit_total NUMERIC;
BEGIN
  IF TG_TABLE_NAME = 'ledger_transactions' THEN
    target_id := NEW.id;
  ELSE
    target_id := NEW.transaction_id;
  END IF;

  SELECT COUNT(*), COALESCE(SUM(amount) FILTER (WHERE direction = 'DEBIT'), 0),
         COALESCE(SUM(amount) FILTER (WHERE direction = 'CREDIT'), 0)
    INTO entry_count, debit_total, credit_total FROM ledger_entries WHERE transaction_id = target_id;
  IF entry_count < 2 OR debit_total <> credit_total THEN
    RAISE EXCEPTION 'Ledger transaction % must contain at least two balanced entries', target_id USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
