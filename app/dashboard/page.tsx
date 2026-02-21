'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertsManager } from '@/components/alerts/alerts-manager';
import { useAlerts } from '@/lib/alerts-context';
import { 
  Bookmark, 
  Eye, 
  MessageSquare, 
  Bell, 
  TrendingUp,
  Clock,
  Download,
  Settings
} from 'lucide-react';
import { 
  SAVED_NOTICES, 
  RECENT_ACTIVITY, 
  RECOMMENDED_NOTICES,
  USER_STATS 
} from '@/lib/user-mock-data';

export default function UserDashboard() {
  const { user, isLoading } = useAuth();
  const { t, language } = useLanguage();
  const { alerts: alertRules, matchedCount } = useAlerts();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return null;
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(language === 'ne' ? 'ne-NP' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {t('dashboard.welcomeBack')} {user.name}
            </h1>
            <p className="text-muted-foreground">
              {t('dashboard.subtitle')}
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t('dashboard.savedNotices')}</p>
                  <p className="text-2xl font-bold text-foreground">{USER_STATS.savedNotices}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Bookmark className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t('dashboard.documentsViewed')}</p>
                  <p className="text-2xl font-bold text-foreground">{USER_STATS.documentsViewed}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Eye className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t('dashboard.questionsAsked')}</p>
                  <p className="text-2xl font-bold text-foreground">{USER_STATS.questionsAsked}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t('dashboard.activeAlerts')}</p>
                  <p className="text-2xl font-bold text-foreground">{alertRules.filter(a => a.enabled).length}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Bell className="w-6 h-6 text-orange-500" />
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Saved Notices */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">{t('dashboard.savedNotices')}</h2>
                  <Button variant="ghost" size="sm">{t('dashboard.viewAll')}</Button>
                </div>
                <div className="space-y-3">
                  {SAVED_NOTICES.map((notice) => (
                    <div
                      key={notice.id}
                      className="flex items-start justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground mb-1 line-clamp-1">
                          {notice.title}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="capitalize">
                            {notice.category}
                          </Badge>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t('dashboard.saved')} {formatDate(notice.savedDate)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-xs text-muted-foreground">{t('dashboard.deadline')}</p>
                        <p className="text-sm font-medium text-foreground">
                          {formatDate(notice.deadline)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Recommended Notices */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">{t('dashboard.recommended')}</h2>
                  </div>
                </div>
                <div className="space-y-3">
                  {RECOMMENDED_NOTICES.map((notice) => (
                    <div
                      key={notice.id}
                      className="flex items-start justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition cursor-pointer"
                    >
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground mb-1">
                          {notice.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="capitalize">
                            {notice.category}
                          </Badge>
                          <span>{notice.reason}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="text-xs font-medium text-green-500">
                          {notice.relevance}% {t('dashboard.match')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Recent Activity */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">{t('dashboard.recentActivity')}</h2>
                <div className="space-y-4">
                  {RECENT_ACTIVITY.map((activity) => (
                    <div key={activity.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {activity.action === 'Viewed' && <Eye className="w-4 h-4 text-primary" />}
                        {activity.action === 'Saved' && <Bookmark className="w-4 h-4 text-primary" />}
                        {activity.action === 'Downloaded' && <Download className="w-4 h-4 text-primary" />}
                        {activity.action === 'Asked Question' && <MessageSquare className="w-4 h-4 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground line-clamp-2">
                          {activity.action}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {activity.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Alert Rules Manager */}
              <Card className="p-6">
                <AlertsManager />
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
