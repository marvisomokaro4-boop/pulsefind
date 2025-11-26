import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BarChart, Activity, TrendingUp, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface AnalyticsSummary {
  period: { days: number; startDate: string };
  overview: {
    totalScans: number;
    noResultScans: number;
    noResultPercentage: string;
    avgConfidence: string;
    avgDuration: number;
    avgQuality: string;
  };
  platformStats: {
    acrcloud: number;
    youtube: number;
    spotify: number;
    cacheHits: number;
  };
  performanceMetrics: {
    avgPreprocessing: number;
    avgFingerprinting: number;
    avgMatching: number;
    avgTotal: number;
  };
  segmentStats: {
    totalSegments: number;
    successfulSegments: number;
    successRate: string;
  };
  errorCounts: { [key: string]: number };
  recentScans: any[];
}

export default function Analytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    checkAdminAndFetchAnalytics();
  }, [days]);

  const checkAdminAndFetchAnalytics = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please sign in to access analytics');
        navigate('/');
        return;
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      if (roleData?.role !== 'admin') {
        toast.error('Admin access required');
        navigate('/');
        return;
      }

      // Fetch analytics
      const { data, error } = await supabase.functions.invoke('get-analytics', {
        body: { days }
      });

      if (error) throw error;
      
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p>No analytics data available</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">PulseFind Analytics</h1>
          <p className="text-muted-foreground">System performance and scan metrics</p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2">
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-lg ${
                days === d ? 'bg-primary text-primary-foreground' : 'bg-secondary'
              }`}
            >
              Last {d} days
            </button>
          ))}
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
              <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.overview.totalScans}</div>
              <p className="text-xs text-muted-foreground">
                {analytics.overview.noResultScans} returned no results
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(parseFloat(analytics.overview.avgConfidence) * 100).toFixed(1)}%</div>
              <Progress value={parseFloat(analytics.overview.avgConfidence) * 100} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(analytics.overview.avgDuration / 1000).toFixed(1)}s</div>
              <p className="text-xs text-muted-foreground">
                Per scan average
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Audio Quality</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(parseFloat(analytics.overview.avgQuality) * 100).toFixed(1)}%</div>
              <Progress value={parseFloat(analytics.overview.avgQuality) * 100} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Detailed Analytics */}
        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="platforms">Platforms</TabsTrigger>
            <TabsTrigger value="segments">Segments</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Processing Breakdown</CardTitle>
                <CardDescription>Average time spent in each phase</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span>Preprocessing</span>
                    <span className="font-medium">{analytics.performanceMetrics.avgPreprocessing.toFixed(0)}ms</span>
                  </div>
                  <Progress value={(analytics.performanceMetrics.avgPreprocessing / analytics.performanceMetrics.avgTotal) * 100} />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span>Fingerprinting</span>
                    <span className="font-medium">{analytics.performanceMetrics.avgFingerprinting.toFixed(0)}ms</span>
                  </div>
                  <Progress value={(analytics.performanceMetrics.avgFingerprinting / analytics.performanceMetrics.avgTotal) * 100} />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span>Matching</span>
                    <span className="font-medium">{analytics.performanceMetrics.avgMatching.toFixed(0)}ms</span>
                  </div>
                  <Progress value={(analytics.performanceMetrics.avgMatching / analytics.performanceMetrics.avgTotal) * 100} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="platforms" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Platform Matches</CardTitle>
                <CardDescription>Total matches found per platform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>ACRCloud</span>
                  <Badge variant="secondary">{analytics.platformStats.acrcloud}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>YouTube</span>
                  <Badge variant="secondary">{analytics.platformStats.youtube}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Spotify</span>
                  <Badge variant="secondary">{analytics.platformStats.spotify}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Cache Hits</span>
                  <Badge variant="default">{analytics.platformStats.cacheHits}</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="segments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Segment Analysis</CardTitle>
                <CardDescription>Success rate across all segments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total Segments</span>
                    <span className="font-medium">{analytics.segmentStats.totalSegments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Successful</span>
                    <span className="font-medium">{analytics.segmentStats.successfulSegments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success Rate</span>
                    <span className="font-medium">{analytics.segmentStats.successRate}%</span>
                  </div>
                  <Progress value={parseFloat(analytics.segmentStats.successRate)} className="mt-4" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Error Frequency</CardTitle>
                <CardDescription>Most common errors encountered</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(analytics.errorCounts).length === 0 ? (
                  <p className="text-muted-foreground">No errors recorded</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(analytics.errorCounts)
                      .sort(([, a], [, b]) => b - a)
                      .map(([error, count]) => (
                        <div key={error} className="flex items-center justify-between">
                          <span className="text-sm">{error}</span>
                          <Badge variant="destructive">{count}</Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
