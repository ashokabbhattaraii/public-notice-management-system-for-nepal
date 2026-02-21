'use client';

import { AdminLayout } from '@/components/admin/admin-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Users, 
  RefreshCw, 
  AlertCircle,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { MOCK_SCRAPING_TASKS, MOCK_SYSTEM_LOGS, MOCK_MODERATION_NOTICES } from '@/lib/admin-mock-data';

export default function AdminDashboard() {
  const stats = [
    {
      title: 'Total Notices',
      value: '1,569',
      change: '+12%',
      icon: FileText,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Active Users',
      value: '342',
      change: '+8%',
      icon: Users,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      title: 'Active Scrapers',
      value: '4',
      change: '-1',
      icon: RefreshCw,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      title: 'Pending Reviews',
      value: '23',
      change: '+5',
      icon: AlertCircle,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
  ];

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'approved':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'error':
      case 'rejected':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'paused':
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard Overview</h1>
          <p className="text-muted-foreground">Monitor system performance and key metrics</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <TrendingUp className="w-3 h-3 text-green-500" />
                      <span className="text-xs text-green-500">{stat.change}</span>
                    </div>
                  </div>
                  <div className={`${stat.bg} ${stat.color} p-3 rounded-lg`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Scraping Tasks */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Recent Scraping Tasks</h2>
            <div className="space-y-3">
              {MOCK_SCRAPING_TASKS.slice(0, 4).map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{task.source}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{formatDate(task.lastRun)}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className={getStatusColor(task.status)}>
                    {task.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Pending Moderation */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Pending Moderation</h2>
            <div className="space-y-3">
              {MOCK_MODERATION_NOTICES.filter(n => n.status === 'pending').map((notice) => (
                <div key={notice.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm line-clamp-2">{notice.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{notice.source}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{notice.confidence}% confidence</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* System Logs */}
          <Card className="p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold text-foreground mb-4">Recent System Logs</h2>
            <div className="space-y-2">
              {MOCK_SYSTEM_LOGS.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors">
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
      </div>
    </AdminLayout>
  );
}
