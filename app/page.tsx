'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { NoticeCard } from '@/components/notices/notice-card';
import { NoticeFilters } from '@/components/notices/notice-filters';
import { NoticeDetailModal } from '@/components/notices/notice-detail-modal';
import { MOCK_NOTICES, Notice } from '@/lib/mock-data';
import { useAuth } from '@/lib/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, TrendingUp, Clock, Zap } from 'lucide-react';

const CATEGORY_STATS = [
  { category: 'exams', label: 'Exams', icon: '📝', color: 'bg-blue-50 dark:bg-blue-950' },
  { category: 'vacancies', label: 'Vacancies', icon: '💼', color: 'bg-green-50 dark:bg-green-950' },
  { category: 'tenders', label: 'Tenders', icon: '🏢', color: 'bg-purple-50 dark:bg-purple-950' },
  { category: 'policy', label: 'Policies', icon: '📋', color: 'bg-amber-50 dark:bg-amber-950' },
  { category: 'announcements', label: 'Announcements', icon: '📢', color: 'bg-cyan-50 dark:bg-cyan-950' },
];

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter and search notices
  const filteredNotices = useMemo(() => {
    return MOCK_NOTICES.filter((notice) => {
      const matchesSearch =
        notice.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notice.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notice.content.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === 'all' || notice.category === selectedCategory;

      const matchesPriority =
        selectedPriority === 'all' || notice.priority === selectedPriority;

      return matchesSearch && matchesCategory && matchesPriority;
    });
  }, [searchQuery, selectedCategory, selectedPriority]);

  const handleNoticeClick = (notice: Notice) => {
    setSelectedNotice(notice);
    setIsModalOpen(true);
  };

  const getCategoryCount = (category: string) => {
    return MOCK_NOTICES.filter(n => n.category === category).length;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Section - Enhanced */}
        <section className="relative border-b border-border bg-gradient-to-r from-card via-card to-primary/5 overflow-hidden">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary rounded-full -mr-48 -mt-48"></div>
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <div className="max-w-3xl">
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-3 text-pretty">
                Nepal Government Notices Hub
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground mb-6 max-w-2xl">
                Central gateway for government notifications from Public Service Commission, Tribhuvan University, Nepal Rastra Bank, Ministry of Foreign Affairs, and more.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="default" className="gap-2">
                  <a href="#notices">
                    <Zap className="w-4 h-4" />
                    View Latest Notices
                  </a>
                </Button>
                {!isAuthenticated && <Button asChild variant="outline">
                  <a href="/login">Sign In for Saved Items</a>
                </Button>}
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="border-b border-border bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {CATEGORY_STATS.map(cat => (
                <Card key={cat.category} className="p-4 text-center hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedCategory(cat.category)}>
                  <div className={`text-3xl mb-2 ${cat.color} w-12 h-12 rounded-lg flex items-center justify-center mx-auto`}>
                    {cat.icon}
                  </div>
                  <p className="text-sm font-medium text-foreground">{cat.label}</p>
                  <p className="text-lg font-bold text-primary mt-1">{getCategoryCount(cat.category as any)}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" id="notices">
          {/* Authentication Notice */}
          {!isAuthenticated && !isLoading && (
            <Alert className="mb-6 border-primary/20 bg-primary/5">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                <span className="font-medium">Pro Tip:</span> <a href="/login" className="font-medium text-primary underline hover:no-underline">Sign in</a> to bookmark notices and get personalized alerts.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar - Filters */}
            <div className="lg:col-span-1">
              <NoticeFilters
                onSearch={setSearchQuery}
                onCategoryChange={setSelectedCategory}
                onPriorityChange={setSelectedPriority}
                selectedCategory={selectedCategory}
                selectedPriority={selectedPriority}
                searchQuery={searchQuery}
              />
            </div>

            {/* Main Content - Notices List */}
            <div className="lg:col-span-3">
              {/* Results Header */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    {searchQuery || selectedCategory !== 'all' || selectedPriority !== 'all'
                      ? 'Search Results'
                      : 'Latest Notices'}
                    <span className="text-lg font-normal text-primary">{filteredNotices.length}</span>
                  </h2>
                  <p className="text-muted-foreground mt-1">
                    {searchQuery && `Showing results for "${searchQuery}"`}
                    {!searchQuery && selectedCategory !== 'all' && `Showing ${selectedCategory} notices`}
                    {!searchQuery && !selectedCategory && `Total notices available`}
                  </p>
                </div>
              </div>

              {/* Loading State */}
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="h-32" />
                    </div>
                  ))}
                </div>
              ) : filteredNotices.length > 0 ? (
                <>
                  {/* Featured Notice (first high priority) */}
                  {filteredNotices.find(n => n.priority === 'high') && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-4 h-4 text-red-500" />
                        <h3 className="text-sm font-semibold text-foreground">Featured</h3>
                      </div>
                      <NoticeCard
                        notice={filteredNotices.find(n => n.priority === 'high')!}
                        onClick={() => handleNoticeClick(filteredNotices.find(n => n.priority === 'high')!)}
                      />
                    </div>
                  )}

                  {/* All Notices */}
                  <div className="space-y-4">
                    {filteredNotices.map((notice) => (
                      <NoticeCard
                        key={notice.id}
                        notice={notice}
                        onClick={() => handleNoticeClick(notice)}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <Empty
                  title="No notices found"
                  description={
                    searchQuery
                      ? `No results for "${searchQuery}". Try different keywords.`
                      : 'No notices matching your filters. Try adjusting your selection.'
                  }
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Notice Detail Modal */}
      <NoticeDetailModal
        notice={selectedNotice}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <Footer />
    </div>
  );
}
