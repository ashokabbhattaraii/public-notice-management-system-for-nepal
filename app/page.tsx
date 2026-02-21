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
import { Skeleton as AnimSkeleton } from '@/components/ui/skeleton';
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
        {/* Clean Google-like Search Interface */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Title Section with animation */}
          <div className="pt-8 pb-6 animate-in fade-in slide-in-from-top-2 duration-500">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
              Government Notices
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Search across all Nepal government agencies and institutions
            </p>
          </div>

          {/* Filters Section */}
          <div className="mb-8 animate-in fade-in slide-in-from-top duration-500 delay-100">
            <NoticeFilters
              onSearch={setSearchQuery}
              onCategoryChange={setSelectedCategory}
              onPriorityChange={setSelectedPriority}
              selectedCategory={selectedCategory}
              selectedPriority={selectedPriority}
              searchQuery={searchQuery}
            />
          </div>

          {/* Authentication Notice */}
          {!isAuthenticated && !isLoading && (
            <Alert className="mb-6 border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-left duration-500 delay-150">
              <AlertCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground text-sm">
                <span className="font-medium">Tip:</span> <a href="/login" className="font-medium text-primary hover:underline transition-all">Sign in</a> to save notices and receive personalized alerts.
              </AlertDescription>
            </Alert>
          )}

          {/* Results Section */}
          <div className="mb-8">
            {/* Results Header */}
            <div className="mb-6 animate-in fade-in duration-500 delay-200">
              <h2 className="text-lg font-semibold text-foreground">
                {searchQuery 
                  ? `Results for "${searchQuery}"` 
                  : selectedCategory !== 'all' 
                    ? `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Notices`
                    : 'All Notices'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredNotices.length} {filteredNotices.length === 1 ? 'result' : 'results'} found
              </p>
            </div>

            {/* Loading State */}
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <AnimSkeleton key={i} className="h-24 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredNotices.length > 0 ? (
              <div className="space-y-3 animate-in fade-in duration-500 delay-300">
                {filteredNotices.map((notice, idx) => (
                  <div
                    key={notice.id}
                    className="animate-in fade-in slide-in-from-bottom-2 duration-500"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <NoticeCard
                      notice={notice}
                      onClick={() => handleNoticeClick(notice)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="animate-in fade-in duration-500">
                <Empty
                  title="No notices found"
                  description={
                    searchQuery
                      ? `No results for "${searchQuery}". Try different search terms.`
                      : 'No notices match your filters. Try adjusting your selection.'
                  }
                />
              </div>
            )}
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
