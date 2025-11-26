-- Update handle_new_user function to exclude first 2 accounts from special offer
-- Pro tier is granted to users 3-102 (100 total promotional spots, excluding first 2 accounts)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_count bigint;
  v_pro_plan_id uuid;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  
  -- Count total profiles (including the one just created)
  SELECT COUNT(*) INTO v_profile_count FROM public.profiles;
  
  -- Grant Pro tier to users 3-102 (excluding first 2 accounts, 100 promotional spots total)
  IF v_profile_count > 2 AND v_profile_count <= 102 THEN
    -- Get Pro plan ID
    SELECT id INTO v_pro_plan_id
    FROM subscription_plans
    WHERE name = 'Pro';
    
    -- Grant Pro subscription for 3 months
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
$function$;