-- Grant Elite tier to marvbeats33@gmail.com
DO $$
DECLARE
  v_user_id uuid;
  v_elite_plan_id uuid;
BEGIN
  -- Get user ID from profiles table
  SELECT id INTO v_user_id
  FROM profiles
  WHERE email = 'marvbeats33@gmail.com';
  
  -- Get Elite plan ID
  SELECT id INTO v_elite_plan_id
  FROM subscription_plans
  WHERE name = 'Elite';
  
  -- Update or insert user subscription
  INSERT INTO user_subscriptions (user_id, plan_id, status, current_period_end)
  VALUES (v_user_id, v_elite_plan_id, 'active', NOW() + INTERVAL '100 years')
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    plan_id = v_elite_plan_id,
    status = 'active',
    current_period_end = NOW() + INTERVAL '100 years',
    updated_at = NOW();
END $$;