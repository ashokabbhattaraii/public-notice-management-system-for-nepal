'use client';

import { AdminLayout } from '@/components/admin/admin-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Cpu, 
  HardDrive, 
  MemoryStick,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import { MOCK_SYSTEM_HEALTH, MOCK_SYSTEM_LOGS } from '@/lib/admin-mock-data';

export default function SystemHealth() {
  const health = MOCK_SYSTEM_HEALTH;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getHealthColor = (value: number) => {
    if (value < 50) return 'text-green-500';
    if (value < 80) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getHealthStatus = (value: number) => {
    if (value < 50) return { text: 'Healthy', color: 'bg-green-500/10 text-green-600 border-green-500/20' };
    if (value < 80) return { text: 'Warning', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' };
    return { text: 'Critical', color: 'bg-red-500/10 text-red-600 border-red-500/20' };
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">System Health</h1>
          <p className="text-muted-foreground">Monitor system resources and performance</p>
        </div>

        {/* Overall Status */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-green-500/10 text-green-500 p-3 rounded-lg">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">System Operational</h2>
                <p className="text-sm text-muted-foreground">All services running normally</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-sm px-3 py-1">
              <CheckCircle className="w-4 h-4 mr-2" />
              Healthy
            </Badge>
          </div>
        </Card>

        {/* Resource Monitoring */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* CPU Usage */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cpu className={`w-5 h-5 ${getHealthColor(health.cpu)}`} />
                <h3 className="font-semibold text-foreground">CPU Usage</h3>
              </div>
              <span className={`text-2xl font-bold ${getHealthColor(health.cpu)}`}>
                {health.cpu}%
              </span>
            </div>
            <Progress value={health.cpu} className="mb-2" />
            <Badge variant="outline" className={getHealthStatus(health.cpu).color}>
              {getHealthStatus(health.cpu).text}
            </Badge>
          </Card>

          {/* Memory Usage */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MemoryStick className={`w-5 h-5 ${getHealthColor(health.memory)}`} />
                <h3 className="font-semibold text-foreground">Memory</h3>
              </div>
              <span className={`text-2xl font-bold ${getHealthColor(health.memory)}`}>
                {health.memory}%
              </span>
            </div>
            <Progress value={health.memory} className="mb-2" />
            <Badge variant="outline" className={getHealthStatus(health.memory).color}>
              {getHealthStatus(health.memory).text}
            </Badge>
          </Card>

          {/* Disk Usage */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HardDrive className={`w-5 h-5 ${getHealthColor(health.disk)}`} />
                <h3 className="font-semibold text-foreground">Disk Space</h3>
              </div>
              <span className={`text-2xl font-bold ${getHealthColor(health.disk)}`}>
                {health.disk}%
              </span>
            </div>
            <Progress value={health.disk} className="mb-2" />
            <Badge variant="outline" className={getHealthStatus(health.disk).color}>
              {getHealthStatus(health.disk).text}
            </Badge>
          </Card>
        </div>

        {/* Service Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/10 text-blue-500 p-2 rounded-lg">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Scrapers</p>
                <p className="text-2xl font-bold text-foreground">{health.activeScrapers}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/10 text-purple-500 p-2 rounded-lg">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Queued Tasks</p>
                <p className="text-2xl font-bold text-foreground">{health.queuedTasks}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-red-500/10 text-red-500 p-2 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Error Rate</p>
                <p className="text-2xl font-bold text-foreground">{health.errorRate}%</p>
              </div>
            </div>
          </Card>
        </div>

        {/* System Logs */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">System Logs</h2>
          <div className="space-y-2">
            {MOCK_SYSTEM_LOGS.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="mt-0.5">
                  {log.level === 'info' && <CheckCircle className="w-4 h-4 text-blue-500" />}
                  {log.level === 'warning' && <AlertCircle className="w-4 h-4 text-yellow-500" />}
                  {log.level === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-foreground text-sm">{log.message}</p>
                    <Badge variant="outline" className="text-xs">
                      {log.source}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(log.timestamp)}</span>
                    {log.details && (
                      <>
                        <span>•</span>
                        <span>{log.details}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
