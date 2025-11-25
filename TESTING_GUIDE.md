# BeatMatch Subscription Tier Testing Guide

## Test File
**Beat File**: `fuck_love_marv_beats.mp3`

## Testing Process

### Step 1: Initial Setup
1. **Sign up or log in** to the application
2. Navigate to the **Home** page where you can upload beats

### Step 2: Test Free Tier (Default)
When you first sign up, you'll be on the **Free Tier** by default (unless you're in the first 50 users).

**Free Tier Features (3 scans/day):**
- ✅ Basic audio fingerprinting
- ✅ Song title, artist, and album info
- ✅ Match confidence scores
- ✅ Platform links (Spotify, Apple Music, YouTube)
- ✅ Album covers
- ✅ Audio previews (if available)
- ❌ **Limited to 5 match results** (upgrade prompt shown if more matches exist)
- ❌ No similar song matching
- ❌ No copyright detection
- ❌ No batch upload
- ❌ No notifications

**What to Test:**
1. Upload `fuck_love_marv_beats.mp3`
2. Wait for analysis to complete
3. Observe:
   - Maximum 5 results displayed
   - If more matches found, you'll see an "Upgrade to Pro" prompt
   - No "Similar Songs" or "Copyright Analysis" sections
4. Check your scan count in the top navigation (should show "Free" plan)

---

### Step 3: Test Pro Tier ($10/month)

**Upgrade Path:**
1. Navigate to **Pricing** page
2. Click "Upgrade to Pro"
3. Complete checkout (includes 7-day free trial)
4. Return to Home page

**Pro Tier Features (50 scans/day):**
- ✅ Everything in Free Tier
- ✅ **All match results shown** (no 5-result limit)
- ✅ **Similar song/vibe matching** (AI-powered recommendations)
- ✅ **Sample/copyright detection** (AI-powered risk analysis)
- ✅ Full confidence scores with filtering
- ✅ Low confidence matches visible
- ❌ No batch upload (single file only)
- ❌ No notifications

**What to Test:**
1. Upload the same beat file again
2. Observe:
   - **All matches displayed** (no artificial limit)
   - **"Similar Songs" section** at the bottom showing AI-recommended similar tracks
   - **"Copyright Analysis" section** showing potential sample/copyright concerns
   - Can toggle "Show low confidence matches" to see all results
3. Compare total match count vs Free Tier

---

### Step 4: Test Elite Tier ($20/month)

**Upgrade Path:**
1. Navigate to **Pricing** page
2. Click "Upgrade to Elite"
3. Complete checkout (no free trial for Elite)
4. Return to Home page

**Elite Tier Features (Unlimited scans):**
- ✅ Everything in Pro Tier
- ✅ **Unlimited daily scans** (no daily limit)
- ✅ **Batch upload** (analyze multiple beats simultaneously)
- ✅ **Real-time notifications** when beats are used in new songs
- ✅ Priority support
- ✅ Dedicated notifications page

**What to Test:**

**Single File Upload:**
1. Upload `fuck_love_marv_beats.mp3` again
2. Verify all Pro features work
3. Note scan counter shows "Unlimited" in navigation

**Batch Upload Test:**
1. Prepare multiple beat files (or use the same file multiple times)
2. Select multiple files in upload dialog
3. Observe:
   - Batch progress indicator showing "Processing file X of Y"
   - Individual progress for each file
   - Side-by-side comparison of all batch results
4. Review batch results showing matches for each file

**Notifications Test:**
1. Navigate to **Notifications** page (only visible for Elite users)
2. Check for any notifications about your beats being detected in new songs
3. This feature continuously monitors for new song releases using your beats

---

## Feature Comparison Matrix

| Feature | Free | Pro | Elite |
|---------|------|-----|-------|
| **Daily Scans** | 3/day | 50/day | Unlimited |
| **Match Results Shown** | First 5 | All | All |
| **Audio Fingerprinting** | ✅ | ✅ | ✅ |
| **Platform Links** | ✅ | ✅ | ✅ |
| **Album Covers** | ✅ | ✅ | ✅ |
| **Audio Previews** | ✅ | ✅ | ✅ |
| **Confidence Scores** | ✅ | ✅ | ✅ |
| **Low Confidence Filter** | ❌ | ✅ | ✅ |
| **Similar Song Matching** | ❌ | ✅ (AI) | ✅ (AI) |
| **Copyright Detection** | ❌ | ✅ (AI) | ✅ (AI) |
| **Batch Upload** | ❌ | ❌ | ✅ |
| **Notifications** | ❌ | ❌ | ✅ |
| **Priority Support** | ❌ | ❌ | ✅ |

---

## Key Testing Observations

### What Changes Between Tiers:

1. **Result Count**
   - Free: Shows "X more results available" prompt if > 5 matches
   - Pro/Elite: Shows all matches without restriction

2. **AI Features Visibility**
   - Free: No "Similar Songs" or "Copyright Analysis" sections
   - Pro/Elite: Both sections appear below match results with AI-generated insights

3. **Upload Interface**
   - Free/Pro: Single file selector only
   - Elite: Multi-select enabled, batch progress shown

4. **Navigation**
   - Free/Pro: No "Notifications" button
   - Elite: "Notifications" button appears in top navigation

5. **Scan Counter**
   - Free: "Free" badge, "3/day" shown
   - Pro: "Pro" badge, "50/day" shown
   - Elite: "Elite" badge, "Unlimited" shown

---

## Expected Results with Test Beat

When you upload `fuck_love_marv_beats.mp3`, expect:

1. **Processing Time**: 30-60 seconds (comprehensive multi-segment analysis)
2. **Confidence Scores**: 60-95% range for matches
3. **Platform Coverage**: Results should include Spotify, Apple Music, and/or YouTube links
4. **AI Features** (Pro/Elite):
   - Similar Songs: 5-10 recommendations based on musical similarity
   - Copyright Analysis: Risk assessment if samples detected

---

## Notes

- **First 50 Users**: Automatically get Elite tier FREE for 3 months
- **Scan Limits**: Reset daily at midnight
- **Year Filter**: Optional feature to filter results by release date
- **Report Missing Links**: Available on all tiers to improve accuracy

---

## Admin Testing

If you have admin access, you can:
1. View analytics dashboard at `/admin`
2. See aggregated missing link reports
3. Monitor system-wide usage patterns
