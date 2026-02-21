'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Check, 
  X, 
  AlertTriangle,
  Search,
  Clock,
  TrendingUp
} from 'lucide-react';
import { MOCK_MODERATION_NOTICES, NoticeModeration } from '@/lib/admin-mock-data';

export default function NoticeModeration() {
  const [notices, setNotices] = useState<NoticeModeration[]>(MOCK_MODERATION_NOTICES);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  const filteredNotices = notices.filter(notice => {
    const matchesSearch = notice.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notice.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || notice.status === activeTab;
    return matchesSearch && matchesTab;
  });

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
      case 'approved':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'rejected':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'duplicate':
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const handleApprove = (noticeId: string) => {
    setNotices(notices.map(notice =>
      notice.id === noticeId ? { ...notice, status: 'approved' as const } : notice
    ));
  };

  const handleReject = (noticeId: string) => {
    setNotices(notices.map(notice =>
      notice.id === noticeId ? { ...notice, status: 'rejected' as const } : notice
    ));
  };

  const handleRemove = (noticeId: string) => {
    setNotices(notices.filter(notice => notice.id !== noticeId));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Notice Moderation</h1>
          <p className="text-muted-foreground">Review and approve scraped notices</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search notices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Pending Review</p>
            <p className="text-2xl font-bold text-foreground">
              {notices.filter(n => n.status === 'pending').length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Approved</p>
            <p className="text-2xl font-bold text-green-600">
              {notices.filter(n => n.status === 'approved').length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Rejected</p>
            <p className="text-2xl font-bold text-red-600">
              {notices.filter(n => n.status === 'rejected').length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Duplicates</p>
            <p className="text-2xl font-bold text-gray-600">
              {notices.filter(n => n.status === 'duplicate').length}
            </p>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="duplicate">Duplicates</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6 space-y-4">
            {filteredNotices.map((notice) => (
              <Card key={notice.id} className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                          {notice.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <Badge variant="outline" className={getStatusColor(notice.status)}>
                            {notice.status}
                          </Badge>
                          <Badge variant="secondary">{notice.category}</Badge>
                          {notice.isDuplicate && (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-600">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Duplicate
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Source</p>
                        <p className="font-medium">{notice.source}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Scraped Date</p>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span className="font-medium">{formatDate(notice.scrapedDate)}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">AI Confidence</p>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          <span className="font-medium">{notice.confidence}%</span>
                        </div>
                      </div>
                      {notice.isDuplicate && notice.duplicateOf && (
                        <div>
                          <p className="text-muted-foreground mb-1">Duplicate Of</p>
                          <p className="font-medium text-sm truncate">{notice.duplicateOf}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {notice.status === 'pending' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleApprove(notice.id)}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReject(notice.id)}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {(notice.status === 'rejected' || notice.status === 'duplicate') && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemove(notice.id)}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
              </Card>
            ))}

            {filteredNotices.length === 0 && (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No notices found</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
