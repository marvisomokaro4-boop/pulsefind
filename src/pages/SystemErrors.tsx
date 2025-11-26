import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, XCircle, TrendingDown, Activity } from "lucide-react";
import { format } from "date-fns";

interface ErrorDetail {
  function: string;
  message: string;
  count: number;
  lastOccurred: string;
}

interface ErrorScan {
  id: string;
  scan_timestamp: string;
  error_count: number;
  critical_errors: number;
  failed_scans: number;
  total_scans: number;
  success_rate: number;
  low_success_rate: boolean;
  error_details: ErrorDetail[];
  created_at: string;
}

const SystemErrors = () => {
  const [errorScans, setErrorScans] = useState<ErrorScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAndFetchData();
  }, []);

  const checkAdminAndFetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

      // Check if user is admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (!roles) {
        navigate('/');
        return;
      }

      setIsAdmin(true);
      await fetchErrorScans();
    } catch (error) {
      console.error('Error checking admin status:', error);
      navigate('/');
    }
  };

  const fetchErrorScans = async () => {
    try {
      const { data, error } = await supabase
        .from('system_error_scans')
        .select('*')
        .order('scan_timestamp', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Cast error_details from Json to ErrorDetail[]
      const scansWithTypedErrors = (data || []).map(scan => ({
        ...scan,
        error_details: Array.isArray(scan.error_details) ? scan.error_details as unknown as ErrorDetail[] : []
      }));

      setErrorScans(scansWithTypedErrors);
    } catch (error) {
      console.error('Error fetching error scans:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin && !loading) {
    return null;
  }

  const latestScan = errorScans[0];

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Error Monitoring</h1>
          <p className="text-muted-foreground">Real-time system health and error tracking</p>
        </div>
        <Badge variant={latestScan?.low_success_rate ? "destructive" : "default"} className="text-sm">
          <Activity className="mr-1 h-4 w-4" />
          {latestScan ? `${latestScan.success_rate.toFixed(1)}% Success` : 'Monitoring'}
        </Badge>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* Latest Scan Summary */}
          {latestScan && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Errors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{latestScan.error_count}</span>
                    <XCircle className={latestScan.error_count > 0 ? "text-destructive" : "text-muted"} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Critical</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-destructive">{latestScan.critical_errors}</span>
                    <AlertTriangle className="text-destructive" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Failed Scans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{latestScan.failed_scans}</span>
                    <TrendingDown className={latestScan.failed_scans > 0 ? "text-destructive" : "text-muted"} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className={`text-2xl font-bold ${latestScan.low_success_rate ? 'text-destructive' : 'text-green-600'}`}>
                      {latestScan.success_rate.toFixed(1)}%
                    </span>
                    <CheckCircle className={latestScan.low_success_rate ? "text-destructive" : "text-green-600"} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Error Scan History */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Error Scans</CardTitle>
              <CardDescription>Last 10 automated system scans (runs every 30 minutes)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorScans.length === 0 ? (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    No error scans recorded yet. System monitoring is active.
                  </AlertDescription>
                </Alert>
              ) : (
                errorScans.map((scan) => (
                  <Card key={scan.id} className={scan.low_success_rate ? 'border-destructive' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">
                            Scan: {format(new Date(scan.scan_timestamp), 'PPpp')}
                          </CardTitle>
                          <CardDescription>
                            {scan.total_scans} total scans | {scan.failed_scans} failed
                          </CardDescription>
                        </div>
                        <Badge variant={scan.low_success_rate ? "destructive" : scan.error_count > 0 ? "secondary" : "default"}>
                          {scan.success_rate.toFixed(1)}% Success
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Errors Found:</span>
                          <Badge variant={scan.error_count > 0 ? "destructive" : "outline"}>
                            {scan.error_count}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Critical Issues:</span>
                          <Badge variant={scan.critical_errors > 0 ? "destructive" : "outline"}>
                            {scan.critical_errors}
                          </Badge>
                        </div>

                        {scan.error_details && scan.error_details.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <h4 className="text-sm font-semibold">Error Details:</h4>
                            <div className="space-y-2">
                              {scan.error_details.slice(0, 3).map((error, idx) => (
                                <Alert key={idx} variant="destructive">
                                  <AlertDescription className="text-xs">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1 pr-2">
                                        <span className="font-mono">{error.function}:</span> {error.message}
                                      </div>
                                      <Badge variant="outline" className="ml-2">
                                        {error.count}×
                                      </Badge>
                                    </div>
                                  </AlertDescription>
                                </Alert>
                              ))}
                              {scan.error_details.length > 3 && (
                                <p className="text-xs text-muted-foreground">
                                  + {scan.error_details.length - 3} more errors
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default SystemErrors;
