/**
 * Analytics Service - Logging & Metrics Tracking
 * Stores scan metrics for threshold tuning and performance monitoring
 */

export interface ScanMetrics {
  userId?: string;
  beatId?: string;
  
  // Performance
  totalDurationMs: number;
  preprocessingDurationMs: number;
  fingerprintDurationMs: number;
  matchingDurationMs: number;
  
  // Scan details
  segmentsAnalyzed: number;
  segmentsSuccessful: number;
  matchingMode: 'strict' | 'loose';
  
  // Results
  totalMatchesFound: number;
  avgConfidenceScore?: number;
  maxConfidenceScore?: number;
  minConfidenceScore?: number;
  
  // Quality
  audioQualityScore?: number;
  silenceTrimmedMs?: number;
  volumeNormalized: boolean;
  
  // Platform breakdown
  acrcloudMatches: number;
  youtubeMatches: number;
  spotifyMatches: number;
  localCacheHit: boolean;
  
  // Errors
  errorsEncountered: number;
  errorMessages: string[];
}

/**
 * Log scan metrics to database
 */
export async function logScanMetrics(
  supabase: any,
  metrics: ScanMetrics
): Promise<void> {
  try {
    const { error } = await supabase
      .from('scan_analytics')
      .insert({
        user_id: metrics.userId,
        beat_id: metrics.beatId,
        total_duration_ms: metrics.totalDurationMs,
        preprocessing_duration_ms: metrics.preprocessingDurationMs,
        fingerprint_duration_ms: metrics.fingerprintDurationMs,
        matching_duration_ms: metrics.matchingDurationMs,
        segments_analyzed: metrics.segmentsAnalyzed,
        segments_successful: metrics.segmentsSuccessful,
        matching_mode: metrics.matchingMode,
        total_matches_found: metrics.totalMatchesFound,
        avg_confidence_score: metrics.avgConfidenceScore,
        max_confidence_score: metrics.maxConfidenceScore,
        min_confidence_score: metrics.minConfidenceScore,
        audio_quality_score: metrics.audioQualityScore,
        silence_trimmed_ms: metrics.silenceTrimmedMs,
        volume_normalized: metrics.volumeNormalized,
        acrcloud_matches: metrics.acrcloudMatches,
        youtube_matches: metrics.youtubeMatches,
        spotify_matches: metrics.spotifyMatches,
        local_cache_hit: metrics.localCacheHit,
        errors_encountered: metrics.errorsEncountered,
        error_messages: metrics.errorMessages
      });
    
    if (error) {
      console.error('[ANALYTICS] Failed to log metrics:', error);
    } else {
      console.log('[ANALYTICS] Metrics logged successfully');
    }
  } catch (error) {
    console.error('[ANALYTICS] Exception logging metrics:', error);
  }
}

/**
 * Calculate statistics from confidence scores
 */
export function calculateConfidenceStats(scores: number[]): {
  avg: number;
  max: number;
  min: number;
} {
  if (scores.length === 0) {
    return { avg: 0, max: 0, min: 0 };
  }
  
  const sum = scores.reduce((a, b) => a + b, 0);
  const avg = sum / scores.length;
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  
  return { avg, max, min };
}

/**
 * Get analytics summary for admin dashboard
 */
export async function getAnalyticsSummary(
  supabase: any,
  days: number = 7
): Promise<any> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const { data, error } = await supabase
    .from('scan_analytics')
    .select('*')
    .gte('scan_date', startDate.toISOString())
    .order('scan_date', { ascending: false });
  
  if (error) {
    console.error('[ANALYTICS] Failed to fetch summary:', error);
    return null;
  }
  
  // Calculate aggregated metrics
  const totalScans = data.length;
  const noResultScans = data.filter((s: any) => s.total_matches_found === 0).length;
  const avgConfidence = data
    .filter((s: any) => s.avg_confidence_score)
    .reduce((sum: number, s: any) => sum + parseFloat(s.avg_confidence_score), 0) / totalScans;
  const avgDuration = data.reduce((sum: number, s: any) => sum + s.total_duration_ms, 0) / totalScans;
  
  // Calculate error frequency
  const errorCounts: { [key: string]: number } = {};
  data.forEach((s: any) => {
    if (s.error_messages && s.error_messages.length > 0) {
      s.error_messages.forEach((msg: string) => {
        errorCounts[msg] = (errorCounts[msg] || 0) + 1;
      });
    }
  });
  
  return {
    totalScans,
    noResultScans,
    noResultPercentage: (noResultScans / totalScans) * 100,
    avgConfidence,
    avgDuration,
    errorCounts,
    recentScans: data.slice(0, 10)
  };
}
