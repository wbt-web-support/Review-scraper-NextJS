import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Zap, Clock, Database } from 'lucide-react';

interface CacheStats {
  totalEntries: number;
  expiredEntries: number;
  validEntries: number;
  cacheSize: number;
}

interface PerformanceMetrics {
  responseTime: number;
  cacheHit: boolean;
  timestamp: number;
}

const PerformanceMonitor: React.FC = () => {
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCacheStats = async () => {
    try {
      const response = await fetch('/api/debug/cache-stats');
      if (response.ok) {
        const data = await response.json();
        setCacheStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching cache stats:', error);
    }
  };

  const clearCache = async () => {
    try {
      const response = await fetch('/api/debug/cache-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (response.ok) {
        await fetchCacheStats();
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  const testPerformance = async () => {
    setIsLoading(true);
    const startTime = Date.now();
    
    try {
      const response = await fetch('/api/dashboard/latest-reviews?limit=10');
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      const newMetric: PerformanceMetrics = {
        responseTime,
        cacheHit: response.headers.get('x-cache-hit') === 'true',
        timestamp: Date.now()
      };
      
      setPerformanceMetrics(prev => [newMetric, ...prev.slice(0, 9)]); // Keep last 10 metrics
    } catch (error) {
      console.error('Error testing performance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCacheStats();
    const interval = setInterval(fetchCacheStats, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const averageResponseTime = performanceMetrics.length > 0 
    ? performanceMetrics.reduce((sum, metric) => sum + metric.responseTime, 0) / performanceMetrics.length
    : 0;

  const cacheHitRate = performanceMetrics.length > 0
    ? (performanceMetrics.filter(metric => metric.cacheHit).length / performanceMetrics.length) * 100
    : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Performance Monitor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cache Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {cacheStats?.totalEntries || 0}
            </div>
            <div className="text-sm text-gray-600">Total Cache Entries</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {cacheStats?.validEntries || 0}
            </div>
            <div className="text-sm text-gray-600">Valid Entries</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {cacheStats?.expiredEntries || 0}
            </div>
            <div className="text-sm text-gray-600">Expired Entries</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {cacheHitRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Cache Hit Rate</div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Average Response Time</span>
            </div>
            <Badge variant={averageResponseTime < 500 ? "default" : averageResponseTime < 1000 ? "secondary" : "destructive"}>
              {averageResponseTime.toFixed(0)}ms
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="text-sm font-medium">Recent Response Times</span>
            </div>
            <div className="flex gap-1">
              {performanceMetrics.slice(0, 5).map((metric, index) => (
                <div
                  key={index}
                  className={`w-2 h-8 rounded-sm ${
                    metric.responseTime < 500 ? 'bg-green-500' :
                    metric.responseTime < 1000 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  title={`${metric.responseTime}ms ${metric.cacheHit ? '(cached)' : '(fresh)'}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={testPerformance} 
            disabled={isLoading}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Test Performance
          </Button>
          <Button 
            onClick={clearCache} 
            size="sm"
            variant="outline"
          >
            Clear Cache
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PerformanceMonitor;
