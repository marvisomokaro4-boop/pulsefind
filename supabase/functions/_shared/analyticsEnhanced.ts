/**
 * Enhanced Analytics Module
 * Track segment performance, confidence trends, and system accuracy
 */

export interface SegmentAnalytics {
  segmentName: string;
  position: string; // e.g., "0%", "30%", "60%"
  matchesFound: number;
  avgConfidence: number;
  maxConfidence: number;
  successRate: number; // 0-1
}

export interface ScanAnalytics {
  scanId: string;
  timestamp: string;
  userId?: string;
  beatId?: string;
  
  // Beat characteristics
  tempo: number;
  energy: number;
  spectralComplexity: number;
  genre?: string;
  
  // Segment performance
  segments: SegmentAnalytics[];
  totalSegments: number;
  successfulSegments: number;
  
  // Match statistics
  totalMatches: number;
  highConfidenceMatches: number; // ≥85%
  mediumConfidenceMatches: number; // 60-84%
  lowConfidenceMatches: number; // <60%
  avgConfidence: number;
  maxConfidence: number;
  minConfidence: number;
  
  // Threshold information
  adaptiveThreshold: {
    strict: number;
    loose: number;
    reason: string;
  };
  
  // Performance metrics
  preprocessingMs: number;
  fingerprintMs: number;
  matchingMs: number;
  totalDurationMs: number;
  
  // Detection sources
  sourceBreakdown: {
    localCache: number;
    acrcloud: number;
    youtube: number;
    spotify: number;
  };
  
  // Errors
  errors: string[];
}

/**
 * Log comprehensive scan analytics to database
 */
export async function logEnhancedAnalytics(
  supabase: any,
  analytics: ScanAnalytics
): Promise<void> {
  try {
    // Store in scan_analytics table (extended schema)
    await supabase.from('scan_analytics').insert({
      id: analytics.scanId,
      user_id: analytics.userId,
      beat_id: analytics.beatId,
      scan_date: analytics.timestamp,
      
      // Performance
      total_duration_ms: analytics.totalDurationMs,
      preprocessing_duration_ms: analytics.preprocessingMs,
      fingerprint_duration_ms: analytics.fingerprintMs,
      matching_duration_ms: analytics.matchingMs,
      
      // Segments
      segments_analyzed: analytics.totalSegments,
      segments_successful: analytics.successfulSegments,
      
      // Matches
      total_matches_found: analytics.totalMatches,
      avg_confidence_score: analytics.avgConfidence,
      max_confidence_score: analytics.maxConfidence,
      min_confidence_score: analytics.minConfidence,
      
      // Sources
      local_cache_hit: analytics.sourceBreakdown.localCache > 0,
      acrcloud_matches: analytics.sourceBreakdown.acrcloud,
      youtube_matches: analytics.sourceBreakdown.youtube,
      spotify_matches: analytics.sourceBreakdown.spotify,
      
      // Quality
      audio_quality_score: analytics.energy,
      
      // Errors
      errors_encountered: analytics.errors.length,
      error_messages: analytics.errors,
      
      matching_mode: 'adaptive' // New: indicate adaptive thresholds used
    });
    
    console.log(`✅ Enhanced analytics logged (ID: ${analytics.scanId})`);
  } catch (error) {
    console.error('❌ Failed to log analytics:', error);
  }
}

/**
 * Calculate segment performance statistics
 */
export function analyzeSegmentPerformance(
  segments: Array<{name: string, results: any[]}>
): SegmentAnalytics[] {
  return segments.map(seg => {
    const matches = seg.results.length;
    const confidences = seg.results.map(r => r.confidence || 0);
    
    const avgConfidence = matches > 0
      ? confidences.reduce((a, b) => a + b, 0) / matches
      : 0;
    
    const maxConfidence = matches > 0 ? Math.max(...confidences) : 0;
    const successRate = matches > 0 ? 1 : 0;
    
    // Extract position from segment name (e.g., "30s@60%" → "60%")
    const positionMatch = seg.name.match(/(\d+)%/);
    const position = positionMatch ? positionMatch[1] + '%' : seg.name;
    
    return {
      segmentName: seg.name,
      position,
      matchesFound: matches,
      avgConfidence,
      maxConfidence,
      successRate
    };
  });
}

/**
 * Detect anomalies in scan results (for quality monitoring)
 */
export function detectAnomalies(analytics: ScanAnalytics): string[] {
  const anomalies: string[] = [];
  
  // Unusually low confidence across all matches
  if (analytics.totalMatches > 0 && analytics.avgConfidence < 50) {
    anomalies.push(`Low avg confidence: ${analytics.avgConfidence.toFixed(1)}%`);
  }
  
  // Unusually high confidence (might indicate overfitting)
  if (analytics.totalMatches > 5 && analytics.avgConfidence > 95) {
    anomalies.push(`Suspiciously high avg confidence: ${analytics.avgConfidence.toFixed(1)}%`);
  }
  
  // Most segments failed
  if (analytics.successfulSegments < analytics.totalSegments * 0.3) {
    anomalies.push(`Low segment success rate: ${analytics.successfulSegments}/${analytics.totalSegments}`);
  }
  
  // Performance issues
  if (analytics.totalDurationMs > 60000) {
    anomalies.push(`Slow scan: ${(analytics.totalDurationMs / 1000).toFixed(1)}s`);
  }
  
  // No matches at all (might indicate audio quality issue)
  if (analytics.totalMatches === 0) {
    anomalies.push('No matches found - check audio quality');
  }
  
  return anomalies;
}

/**
 * Generate performance insights summary
 */
export function generateInsightsSummary(analytics: ScanAnalytics): string {
  const insights: string[] = [];
  
  // Segment insights
  const bestSegment = analytics.segments.reduce((best, seg) => 
    seg.avgConfidence > best.avgConfidence ? seg : best
  , analytics.segments[0]);
  
  if (bestSegment) {
    insights.push(`Best performing segment: ${bestSegment.segmentName} (${bestSegment.avgConfidence.toFixed(1)}% avg)`);
  }
  
  // Source insights
  const primarySource = Object.entries(analytics.sourceBreakdown)
    .reduce((a, b) => b[1] > a[1] ? b : a)[0];
  
  insights.push(`Primary detection source: ${primarySource} (${analytics.sourceBreakdown[primarySource as keyof typeof analytics.sourceBreakdown]} matches)`);
  
  // Adaptive threshold insight
  insights.push(`Adaptive thresholds: ${analytics.adaptiveThreshold.reason}`);
  
  // Performance insight
  const avgTimePerSegment = analytics.totalSegments > 0
    ? analytics.totalDurationMs / analytics.totalSegments
    : 0;
  insights.push(`Avg time per segment: ${avgTimePerSegment.toFixed(0)}ms`);
  
  return insights.join(' | ');
}
