-- Update handle_new_user function to grant Pro plan forever to first 2 users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile_count bigint;
  v_pro_plan_id uuid;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  
  -- Count total profiles (including the one just created)
  SELECT COUNT(*) INTO v_profile_count FROM public.profiles;
  
  -- Get Pro plan ID
  SELECT id INTO v_pro_plan_id
  FROM subscription_plans
  WHERE name = 'Pro';
  
  -- Grant Pro tier to first 2 users FOREVER (no expiration)
  IF v_profile_count <= 2 THEN
    INSERT INTO user_subscriptions (user_id, plan_id, status, current_period_end)
    VALUES (NEW.id, v_pro_plan_id, 'active', NULL)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      plan_id = v_pro_plan_id,
      status = 'active',
      current_period_end = NULL,
      updated_at = NOW();
  
  -- Grant Pro tier to users 3-102 for 3 months (100 promotional spots)
  ELSIF v_profile_count > 2 AND v_profile_count <= 102 THEN
    INSERT INTO user_subscriptions (user_id, plan_id, status, current_period_end)
    VALUES (NEW.id, v_pro_plan_id, 'active', NOW() + INTERVAL '3 months')
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      plan_id = v_pro_plan_id,
      status = 'active',
      current_period_end = NOW() + INTERVAL '3 months',
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;