-- 增加用户总消费
CREATE OR REPLACE FUNCTION increment_total_spend(
  p_user_id UUID,
  p_amount DECIMAL
)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET total_spend = COALESCE(total_spend, 0) + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
