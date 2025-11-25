-- Update the handle_new_user function to grant Elite tier to first 50 signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_count bigint;
  v_elite_plan_id uuid;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  
  -- Count total profiles (including the one just created)
  SELECT COUNT(*) INTO v_profile_count FROM public.profiles;
  
  -- If user is in first 50, grant Elite tier for 3 months
  IF v_profile_count <= 50 THEN
    -- Get Elite plan ID
    SELECT id INTO v_elite_plan_id
    FROM subscription_plans
    WHERE name = 'Elite';
    
    -- Grant Elite subscription for 3 months
    INSERT INTO user_subscriptions (user_id, plan_id, status, current_period_end)
    VALUES (NEW.id, v_elite_plan_id, 'active', NOW() + INTERVAL '3 months')
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      plan_id = v_elite_plan_id,
      status = 'active',
      current_period_end = NOW() + INTERVAL '3 months',
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$function$;