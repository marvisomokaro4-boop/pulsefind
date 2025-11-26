# PulseFind Backend Architecture Documentation

## Overview
PulseFind uses Supabase (PostgreSQL) for database, authentication, and serverless edge functions. The backend handles beat identification, multi-source audio detection, subscription management, and automated monitoring.

---

## Database Schema

### Core Tables

#### **profiles**
User account information
- `id` (uuid, PK) - Links to auth.users
- `email` (text)
- `created_at` (timestamp)
- `has_seen_onboarding` (boolean)
- `logo_url` (text) - Custom user logo

#### **user_roles**
Role-based access control
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles)
- `role` (enum: 'admin' | 'user')
- `created_at` (timestamp)

#### **subscription_plans**
Available subscription tiers
- `id` (uuid, PK)
- `name` (text) - 'Free' or 'Pro'
- `price_monthly` (numeric) - £4.99 for Pro
- `scans_per_day` (integer) - 1 for Free, -1 (unlimited) for Pro
- `stripe_price_id` (text)
- `features` (jsonb)

#### **user_subscriptions**
User subscription status
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles, unique)
- `plan_id` (uuid, FK → subscription_plans)
- `status` (text) - 'active', 'canceled', 'expired'
- `stripe_customer_id` (text)
- `stripe_subscription_id` (text)
- `current_period_end` (timestamp) - NULL for first 2 users (permanent Pro)
- `trial_end` (timestamp)

### Beat Management

#### **beats**
Uploaded producer beats
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles)
- `file_name` (text)
- `file_size` (integer)
- `uploaded_at` (timestamp)

#### **beat_matches**
Identified songs using beats
- `id` (uuid, PK)
- `beat_id` (uuid, FK → beats)
- `song_title` (text)
- `artist` (text)
- `album` (text)
- `confidence` (numeric) - Match confidence score
- `source` (text) - 'acrcloud', 'youtube', 'spotify', 'local'
- `spotify_id`, `spotify_url` (text)
- `youtube_id`, `youtube_url` (text)
- `apple_music_id`, `apple_music_url` (text)
- `album_cover_url` (text)
- `preview_url` (text) - Spotify 30s preview
- `popularity` (integer) - Spotify stream count
- `release_date` (text)
- `identified_at` (timestamp)

#### **beat_fingerprints**
Local fingerprint database for instant matching
- `id` (uuid, PK)
- `fingerprint_hash` (text, indexed) - Chromaprint binary fingerprint
- `mfcc_features` (jsonb) - MFCC feature vectors
- `song_title` (text)
- `artist` (text)
- `album` (text)
- `isrc` (text) - International Standard Recording Code
- `source` (text) - 'acrcloud', 'local', 'youtube', 'spotify'
- `confidence_score` (numeric)
- `match_count` (integer) - Times this fingerprint matched
- `audio_duration_ms` (integer)
- `spotify_id`, `spotify_url` (text)
- `youtube_id`, `youtube_url` (text)
- `apple_music_id`, `apple_music_url` (text)
- `album_cover_url`, `preview_url` (text)
- `popularity` (integer)
- `release_date` (text)

### Monitoring & Analytics

#### **beat_notifications**
Auto-alert notifications for new matches
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles)
- `beat_id` (uuid, FK → beats)
- `match_id` (uuid, FK → beat_matches)
- `read` (boolean)
- `notified_at` (timestamp)
- `created_at` (timestamp)

#### **auto_alert_settings**
User preferences for automated scanning
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles)
- `enabled` (boolean)
- `scan_frequency` (text) - 'daily', 'weekly'
- `last_scan_at` (timestamp)

#### **scan_analytics**
Performance metrics for each scan
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles)
- `beat_id` (uuid, FK → beats)
- `scan_date` (timestamp)
- `matching_mode` (text) - 'loose' or 'strict'
- `total_duration_ms` (integer) - Total scan time
- `preprocessing_duration_ms` (integer)
- `fingerprint_duration_ms` (integer)
- `matching_duration_ms` (integer)
- `segments_analyzed` (integer)
- `segments_successful` (integer)
- `total_matches_found` (integer)
- `acrcloud_matches` (integer)
- `youtube_matches` (integer)
- `spotify_matches` (integer)
- `local_cache_hit` (boolean)
- `audio_quality_score` (numeric)
- `avg_confidence_score`, `min_confidence_score`, `max_confidence_score` (numeric)
- `volume_normalized` (boolean)
- `silence_trimmed_ms` (integer)
- `errors_encountered` (integer)
- `error_messages` (text[])

### Usage Tracking

#### **scan_usage**
Daily scan count per user
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles)
- `scan_date` (date, default: current_date)
- `scan_count` (integer, default: 0)
- Unique constraint on (user_id, scan_date)

#### **anonymous_scans**
IP-based tracking for non-authenticated users
- `id` (uuid, PK)
- `ip_address` (text)
- `scan_count` (integer, default: 1)
- `last_scan_at` (timestamp)

#### **rate_limits**
API rate limiting
- `id` (uuid, PK)
- `identifier` (text) - IP or user_id
- `endpoint` (text)
- `request_count` (integer)
- `window_start` (timestamp)

### Feedback & Reporting

#### **feedback**
User bug reports and feature requests
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles, nullable)
- `type` (text) - 'bug', 'feature', 'general'
- `subject` (text)
- `message` (text)
- `email` (text)
- `status` (text) - 'new', 'in_progress', 'resolved'

#### **missing_link_reports**
User-reported missing platform links
- `id` (uuid, PK)
- `user_id` (uuid, FK → profiles)
- `beat_match_id` (uuid, FK → beat_matches, nullable)
- `song_title` (text)
- `artist` (text)
- `album` (text)
- `reported_platform` (text) - 'spotify', 'youtube', 'apple_music'
- `spotify_id`, `youtube_id`, `apple_music_id` (text)
- `reported_at` (timestamp)

---

## Database Functions

### **get_scan_usage(_user_id uuid)**
Returns user's current scan usage and daily limit
- Fetches active subscription plan
- Returns scan_count and scans_per_day
- Creates today's usage record if missing

### **increment_scan_count(_user_id uuid)**
Increments user's daily scan count
- Checks if under limit (-1 = unlimited)
- Returns true if scan allowed, false if limit reached

### **has_role(_user_id uuid, _role app_role)**
Security definer function to check user roles
- Used in RLS policies
- Prevents recursive RLS issues

### **increment_fingerprint_match_count(fingerprint_id uuid)**
Increments match_count for fingerprint analytics

### **cleanup_old_anonymous_scans()**
Removes anonymous scans older than 30 days

### **cleanup_old_rate_limits()**
Removes rate limit records older than 24 hours

---

## Edge Functions (Serverless API)

### **identify-beat** (Public)
Main beat identification endpoint
- **Input**: Audio file (multipart/form-data), deepScan (boolean), matchingMode ('loose'|'strict')
- **Process**:
  1. Audio preprocessing (normalize, trim silence, convert to 16-bit PCM WAV 44.1kHz)
  2. Generate Chromaprint binary fingerprint + MFCC features
  3. Search local `beat_fingerprints` database (instant cache hit)
  4. If no cache hit, segment audio (start/middle/end, 15s/20s/30s)
  5. Send segments to ACRCloud for fingerprinting
  6. Parallel search: YouTube Music API, Spotify API
  7. Deduplicate by ISRC and title+artist
  8. Enrich with Spotify popularity/stream counts
  9. Filter by confidence threshold (40% loose, 85% strict)
  10. Store top matches in `beat_fingerprints` for future cache
  11. Log metrics to `scan_analytics`
- **Output**: Array of matches with confidence, platform links, popularity

### **check-subscription** (Auth Required)
Returns user's subscription status
- Fetches active subscription from `user_subscriptions`
- Returns plan name, scans_per_day, current usage

### **create-checkout** (Auth Required)
Creates Stripe checkout session for Pro subscription
- Input: priceId (Stripe price ID)
- Creates Stripe customer if needed
- Returns checkout session URL

### **customer-portal** (Auth Required)
Generates Stripe customer portal link
- Allows users to manage subscription/billing

### **get-analytics** (Admin Only)
Returns scan analytics dashboard data
- Input: days (default: 7)
- Aggregates scan_analytics data:
  - Total scans, no-result scans
  - Average confidence, duration, quality
  - Platform breakdown (ACRCloud/YouTube/Spotify)
  - Error analysis
  - Recent scans list

### **generate-evidence-package** (Auth Required)
Creates legal-grade PDF evidence report
- Input: matchId (uuid)
- Fetches match details from `beat_matches`
- Generates PDF with:
  - Case ID, beat info, match details
  - Confidence scores, timestamps
  - Platform links, infringing user/channel
  - Pre-filled DMCA template
- Returns PDF as downloadable blob

### **send-alert-email** (Internal)
Sends email notifications for auto-alerts
- Input: userEmail, beatName, matches array
- Uses Resend API to send formatted email
- Includes match details and Evidence Package button

### **auto-alert-scan** (Scheduled)
Runs hourly to detect new beat usage
- Fetches all Pro users with auto-alerts enabled
- Re-scans their beats via identify-beat
- Compares against existing `beat_matches`
- Creates `beat_notifications` for new matches
- Invokes `send-alert-email` for each user

### **recheck-missing-links** (Admin)
Batch re-processes missing link reports
- Queries iTunes Search API for reported songs
- Updates `beat_matches` with found links
- Marks reports as resolved

### **fetch-spotify-popularity** (Internal)
Fetches Spotify stream counts for matches
- Input: spotifyId
- Returns popularity score (0-100)

### **get-promo-stats** (Public)
Returns promotional offer statistics
- Counts total users
- Calculates remaining spots (first 100 users get 3-month Pro trial)

---

## Authentication & Authorization

### Authentication Flow
1. Users sign up/login via Supabase Auth (email/password)
2. `handle_new_user()` trigger creates profile + assigns subscription:
   - First 2 users: Permanent Pro (no expiration)
   - Users 3-102: Pro with 3-month trial
   - Users 103+: Free tier
3. JWT token stored in localStorage
4. Token passed in Authorization header for authenticated requests

### Row-Level Security (RLS)
All tables have RLS enabled with policies:

**profiles**: Users can view/update their own profile  
**beats**: Users can CRUD their own beats  
**beat_matches**: Users can view/insert matches for their beats  
**beat_notifications**: Users can view/update their own notifications  
**scan_usage**: Users can view/update their own usage  
**scan_analytics**: Users view own, admins view all  
**feedback**: Anyone can insert, users view own, admins view all  
**user_subscriptions**: Users can view/update their own subscription  
**subscription_plans**: Public read-only  
**beat_fingerprints**: Public read, service role manages  
**anonymous_scans**: Service role only  
**rate_limits**: Service role only  

### Admin Access
- Stored in `user_roles` table (enum: 'admin' | 'user')
- `has_role()` security definer function used in RLS policies
- Admins can access `/admin/analytics` dashboard

---

## Payment Integration (Stripe)

### Webhook Events
**checkout.session.completed**
- Upgrades user to Pro tier
- Stores stripe_customer_id and stripe_subscription_id

**customer.subscription.updated**
- Updates subscription status and current_period_end

**customer.subscription.deleted**
- Downgrades user to Free tier

### Products
- **free_plan**: No billing, used for tagging
- **pro_plan**: £4.99/month recurring

---

## Audio Processing Pipeline

### 1. Client-Side Preprocessing
- Convert to 16-bit PCM WAV, 44.1kHz mono
- Volume normalization (target: -20dB)
- Silence trimming from start/end

### 2. Fingerprinting
**Chromaprint Binary Fingerprint**
- Spectral energy analysis across frequency bins
- 2048 sample frames, 50% overlap
- Binary hash for exact matching via Hamming distance

**MFCC Features**
- Mel-Frequency Cepstral Coefficients
- 13 coefficients per frame
- Used for fuzzy similarity matching

### 3. Segmentation Strategy
- Full audio fingerprint
- Strategic segments: start (0-30s), middle, end
- Multiple durations: 15s, 20s, 30s
- Overlapping coverage to catch partial usage

### 4. Multi-Source Detection
**Local Database** (Instant)
- Search `beat_fingerprints` by Hamming distance
- ≥85% similarity for strict, ≥70% for loose

**ACRCloud** (Primary)
- Send segments for fingerprinting
- Returns matches with confidence scores

**YouTube Music API** (Parallel)
- Direct audio search
- BPM-based fallback search

**Spotify API** (Parallel)
- Track search by title + artist
- Fetch popularity/stream counts

### 5. Result Processing
- Deduplicate by ISRC (primary) and title+artist (fallback)
- Filter by confidence threshold
- Enrich with platform links and metadata
- Sort by popularity (Spotify streams)
- Cache top matches in local database

---

## Key Environment Variables

**Supabase**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**External APIs**
- `ACRCLOUD_ACCESS_KEY`
- `ACRCLOUD_ACCESS_SECRET`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `YOUTUBE_API_KEY`

**Payments**
- `STRIPE_SECRET_KEY`

**Notifications**
- `RESEND_API_KEY`

---

## Performance Optimizations

### Caching Strategy
- Local fingerprint database for instant matches (sub-second)
- Stores top 3 matches per fingerprint
- Increments match_count for analytics

### Parallel Processing
- Simultaneous ACRCloud, YouTube, Spotify queries
- Multiple segment processing

### Analytics & Monitoring
- Comprehensive `scan_analytics` logging
- Track preprocessing, fingerprinting, matching times
- Monitor segment success rates
- Error logging for debugging

### Rate Limiting
- IP-based for anonymous users (1 scan/session)
- User-based for authenticated (per subscription tier)
- Endpoint-specific windows

---

## Security Considerations

### Authentication
- JWT-based auth via Supabase
- Secure password hashing (bcrypt)
- Email verification required (auto-confirm enabled)

### Authorization
- Row-Level Security on all tables
- Security definer functions for role checks
- Admin-only endpoints gated by `has_role()`

### Data Privacy
- User data isolated via RLS
- API keys stored as environment secrets
- No sensitive data in logs

### API Security
- Rate limiting on public endpoints
- Input validation and sanitization
- CORS properly configured

---

## Monitoring & Debugging

### Admin Analytics Dashboard (`/admin/analytics`)
- Total scans, success/failure rates
- Platform breakdown (ACRCloud/YouTube/Spotify/local cache)
- Average confidence scores
- Performance metrics (preprocessing, fingerprinting, matching times)
- Error analysis and messages
- Recent scans with full details

### Logs
- Edge function logs via Supabase dashboard
- `scan_analytics` table for historical data
- Error messages stored in analytics for debugging

---

## Roadmap & Future Enhancements

### Phase 3: Advanced Features
- **Neural Embeddings** (OpenL3/VGGish) for remix detection
- **Dynamic Time Warping (DTW)** for tempo-shifted versions
- **Tempo/Pitch Normalization** for transposed beats
- **TikTok & Instagram Reels** audio index integration

### Phase 4: Platform Maturity
- Enhanced evidence package with waveform overlays
- Multi-beat comparison dashboard
- Historical trend analysis
- White-label licensing detection

---

## Contact & Support
For technical questions about this backend architecture, contact the PulseFind development team.

**Version**: 1.0  
**Last Updated**: January 2025  
**Database Schema Version**: Current
