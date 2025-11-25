import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

interface RateLimitConfig {
  maxRequests: number;
  windowMinutes: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (usually IP address)
 * @param endpoint - Endpoint name for separate limits per endpoint
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed and rate limit info
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig = { maxRequests: 10, windowMinutes: 15 }
): Promise<RateLimitResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase credentials for rate limiting");
    // Fail open - allow the request if we can't check rate limits
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(Date.now() + config.windowMinutes * 60 * 1000),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  try {
    // Calculate the current window start (rounded down to nearest window)
    const now = new Date();
    const windowStart = new Date(
      Math.floor(now.getTime() / (config.windowMinutes * 60 * 1000)) *
        (config.windowMinutes * 60 * 1000)
    );

    // Try to get existing rate limit record for this window
    const { data: existingRecord, error: fetchError } = await supabase
      .from("rate_limits")
      .select("*")
      .eq("identifier", identifier)
      .eq("endpoint", endpoint)
      .eq("window_start", windowStart.toISOString())
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching rate limit:", fetchError);
      // Fail open
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: new Date(windowStart.getTime() + config.windowMinutes * 60 * 1000),
      };
    }

    if (existingRecord) {
      // Check if limit exceeded
      if (existingRecord.request_count >= config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(windowStart.getTime() + config.windowMinutes * 60 * 1000),
        };
      }

      // Increment counter
      const { error: updateError } = await supabase
        .from("rate_limits")
        .update({
          request_count: existingRecord.request_count + 1,
          updated_at: now.toISOString(),
        })
        .eq("id", existingRecord.id);

      if (updateError) {
        console.error("Error updating rate limit:", updateError);
        // Fail open on update error
        return {
          allowed: true,
          remaining: config.maxRequests - existingRecord.request_count,
          resetAt: new Date(windowStart.getTime() + config.windowMinutes * 60 * 1000),
        };
      }

      return {
        allowed: true,
        remaining: config.maxRequests - existingRecord.request_count - 1,
        resetAt: new Date(windowStart.getTime() + config.windowMinutes * 60 * 1000),
      };
    } else {
      // Create new record for this window
      const { error: insertError } = await supabase.from("rate_limits").insert({
        identifier,
        endpoint,
        request_count: 1,
        window_start: windowStart.toISOString(),
      });

      if (insertError) {
        console.error("Error creating rate limit record:", insertError);
        // Fail open on insert error
        return {
          allowed: true,
          remaining: config.maxRequests - 1,
          resetAt: new Date(windowStart.getTime() + config.windowMinutes * 60 * 1000),
        };
      }

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: new Date(windowStart.getTime() + config.windowMinutes * 60 * 1000),
      };
    }
  } catch (error) {
    console.error("Unexpected error in rate limiting:", error);
    // Fail open on unexpected errors
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(Date.now() + config.windowMinutes * 60 * 1000),
    };
  }
}

/**
 * Get the client IP address from the request
 * @param req - The incoming request
 * @returns IP address or a fallback identifier
 */
export function getClientIdentifier(req: Request): string {
  // Try various headers that might contain the real IP
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const cfConnectingIp = req.headers.get("cf-connecting-ip");

  // Use the first available IP
  if (cfConnectingIp) return cfConnectingIp;
  if (realIp) return realIp;
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list
    const ips = forwardedFor.split(",").map((ip) => ip.trim());
    return ips[0];
  }

  // Fallback to a generic identifier if no IP is available
  return "unknown";
}
