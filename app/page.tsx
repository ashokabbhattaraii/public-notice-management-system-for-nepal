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
import { AlertCircle } from 'lucide-react';

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

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-border bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2 text-pretty">
              Institutional Notices & Updates
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Stay informed with the latest announcements, exam schedules, job opportunities, and policy updates from your institution.
            </p>
          </div>
        </section>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Authentication Notice */}
          {!isAuthenticated && !isLoading && (
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You're browsing as a guest. <a href="/login" className="font-medium underline hover:no-underline">Sign in</a> to save notices and personalize your experience.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar - Filters */}
            <div className="lg:col-span-1">
              <div className="sticky top-20">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Filter Notices
                </h2>
                <NoticeFilters
                  onSearch={setSearchQuery}
                  onCategoryChange={setSelectedCategory}
                  onPriorityChange={setSelectedPriority}
                  selectedCategory={selectedCategory}
                  selectedPriority={selectedPriority}
                  searchQuery={searchQuery}
                />
              </div>
            </div>

            {/* Main Content - Notices List */}
            <div className="lg:col-span-3">
              {/* Results Header */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-foreground">
                  {searchQuery || selectedCategory !== 'all' || selectedPriority !== 'all'
                    ? 'Search Results'
                    : 'All Notices'}
                </h2>
                <p className="text-muted-foreground">
                  {filteredNotices.length} {filteredNotices.length === 1 ? 'notice' : 'notices'} found
                </p>
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
                <div className="space-y-4">
                  {filteredNotices.map((notice) => (
                    <NoticeCard
                      key={notice.id}
                      notice={notice}
                      onClick={() => handleNoticeClick(notice)}
                    />
                  ))}
                </div>
              ) : (
                <Empty
                  title="No notices found"
                  description={
                    searchQuery
                      ? `Try adjusting your search terms or filters`
                      : 'There are no notices matching your criteria'
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
