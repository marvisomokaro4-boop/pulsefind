/**
 * YouTube Data API v3 integration for searching videos by song/beat metadata
 */

interface YouTubeSearchResult {
  title: string;
  artist: string;
  youtube_id: string;
  youtube_url: string;
  source: string;
  confidence: number;
}

/**
 * Search YouTube for videos matching the song/beat metadata
 */
export async function searchYouTube(
  songTitle: string,
  artist?: string
): Promise<YouTubeSearchResult[]> {
  const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
  
  if (!YOUTUBE_API_KEY) {
    console.warn('⚠️  YouTube API key not configured');
    return [];
  }

  try {
    // Construct search query
    const query = artist ? `${artist} ${songTitle}` : songTitle;
    const searchQuery = encodeURIComponent(`${query} official audio`);

    console.log(`🔍 YouTube search: "${query}"`);

    // Search YouTube videos
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&videoCategoryId=10&maxResults=10&key=${YOUTUBE_API_KEY}`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (!response.ok || !data.items) {
      console.warn(`⚠️  YouTube search failed: ${data.error?.message || 'Unknown error'}`);
      return [];
    }

    // Map YouTube results to our format
    const results: YouTubeSearchResult[] = data.items.map((item: any) => {
      const videoId = item.id.videoId;
      const title = item.snippet.title;
      const channelTitle = item.snippet.channelTitle;

      // Calculate confidence based on title match
      const titleMatch = calculateMatchConfidence(query, title);

      return {
        title: cleanTitle(title),
        artist: channelTitle,
        youtube_id: videoId,
        youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
        source: 'YouTube',
        confidence: titleMatch,
      };
    });

    // Filter results with minimum confidence (50%)
    const filtered = results.filter(r => r.confidence >= 50);
    console.log(`✅ YouTube found ${filtered.length}/${data.items.length} matches`);

    return filtered;

  } catch (error) {
    console.error('❌ YouTube search error:', error);
    return [];
  }
}

/**
 * Calculate match confidence between query and result title
 */
function calculateMatchConfidence(query: string, title: string): number {
  const queryLower = query.toLowerCase();
  const titleLower = title.toLowerCase();

  // Exact match = 100%
  if (titleLower.includes(queryLower)) return 100;

  // Check word overlap
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  const titleWords = titleLower.split(/\s+/);
  
  const matchedWords = queryWords.filter(qw => 
    titleWords.some(tw => tw.includes(qw) || qw.includes(tw))
  );

  const overlapRatio = matchedWords.length / queryWords.length;
  return Math.round(overlapRatio * 100);
}

/**
 * Clean YouTube title by removing common suffixes
 */
function cleanTitle(title: string): string {
  return title
    .replace(/\s*\(official\s*(audio|video|music\s*video|lyric\s*video)\)/gi, '')
    .replace(/\s*\[official\s*(audio|video|music\s*video|lyric\s*video)\]/gi, '')
    .replace(/\s*-\s*(official\s*)?(audio|video|music\s*video|lyric\s*video)/gi, '')
    .trim();
}
