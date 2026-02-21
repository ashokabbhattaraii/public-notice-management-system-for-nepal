'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Settings, 
  Plus,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp
} from 'lucide-react';
import { MOCK_SCRAPING_TASKS, ScrapingTask } from '@/lib/admin-mock-data';

export default function ScrapingManagement() {
  const [tasks, setTasks] = useState<ScrapingTask[]>(MOCK_SCRAPING_TASKS);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTasks = tasks.filter(task =>
    task.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'error':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'completed':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const toggleTaskStatus = (taskId: string) => {
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          status: task.status === 'active' ? 'paused' : 'active'
        };
      }
      return task;
    }));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Scraping Tasks</h1>
            <p className="text-muted-foreground">Manage and monitor website scraping tasks</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add New Task
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by source or URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-500/10 text-green-500 p-2 rounded-lg">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-xl font-bold text-foreground">
                  {tasks.filter(t => t.status === 'active').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-500/10 text-yellow-500 p-2 rounded-lg">
                <Pause className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paused</p>
                <p className="text-xl font-bold text-foreground">
                  {tasks.filter(t => t.status === 'paused').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-red-500/10 text-red-500 p-2 rounded-lg">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-xl font-bold text-foreground">
                  {tasks.filter(t => t.status === 'error').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/10 text-blue-500 p-2 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Success</p>
                <p className="text-xl font-bold text-foreground">
                  {(tasks.reduce((acc, t) => acc + t.successRate, 0) / tasks.length).toFixed(1)}%
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tasks List */}
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <Card key={task.id} className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-foreground">{task.source}</h3>
                    <Badge variant="outline" className={getStatusColor(task.status)}>
                      {task.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{task.url}</p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">Last Run</p>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span className="font-medium">{formatDate(task.lastRun)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Next Run</p>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span className="font-medium">{formatDate(task.nextRun)}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Success Rate</p>
                      <p className="font-medium text-green-600">{task.successRate}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Notices Scraped</p>
                      <p className="font-medium">{task.noticesScraped}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTaskStatus(task.id)}
                  >
                    {task.status === 'active' ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Run Now
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
