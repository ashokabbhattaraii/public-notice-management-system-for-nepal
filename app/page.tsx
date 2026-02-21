'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { NoticeCard } from '@/components/notices/notice-card';
import { NoticeFilters } from '@/components/notices/notice-filters';
import { NoticeDetailModal } from '@/components/notices/notice-detail-modal';
import { FloatingChatWidget } from '@/components/rag/floating-chat-widget';
import { DecorativeBackground } from '@/components/ui/decorative-bg';
import { MOCK_NOTICES, Notice } from '@/lib/mock-data';
import { useAuth } from '@/lib/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty } from '@/components/ui/empty';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton as AnimSkeleton } from '@/components/ui/skeleton';
import { AlertCircle, Sparkles } from 'lucide-react';

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
    <div className="flex flex-col min-h-screen bg-background relative">
      <DecorativeBackground />
      <Header />

      <main className="flex-1 relative z-10">
        {/* Clean Google-like Search Interface */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Title Section with animation */}
          <div className="pt-10 pb-8 animate-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 mb-4 animate-in delay-100">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium gradient-text">AI-Powered Search</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-3 text-balance animate-in delay-150">
              Government Notices & <span className="gradient-text">Announcements</span>
            </h1>
            <p className="text-muted-foreground text-base lg:text-lg leading-relaxed max-w-2xl animate-in delay-200">
              Search and discover official notices from Nepal government agencies and institutions
            </p>
          </div>

          {/* Filters Section */}
          <div className="mb-10">
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
            <Alert className="mb-8 border-blue-500/20 bg-blue-500/5">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-foreground text-sm leading-relaxed">
                <a href="/login" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors">Sign in</a> to bookmark notices and receive personalized alerts about new announcements.
              </AlertDescription>
            </Alert>
          )}

          {/* Results Section */}
          <div className="mb-12">
            {/* Results Header */}
            <div className="mb-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-semibold text-foreground">
                  {searchQuery 
                    ? `Search Results` 
                    : selectedCategory !== 'all' 
                      ? `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Notices`
                      : 'Recent Notices'}
                </h2>
                <p className="text-sm text-muted-foreground font-medium">
                  {filteredNotices.length} {filteredNotices.length === 1 ? 'notice' : 'notices'}
                </p>
              </div>
              {searchQuery && (
                <p className="text-sm text-muted-foreground mt-1.5">
                  Showing results for <span className="font-semibold text-foreground">"{searchQuery}"</span>
                </p>
              )}
            </div>

            {/* Loading State */}
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <AnimSkeleton key={i} className="h-32 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredNotices.length > 0 ? (
              <div className="space-y-4">
                {filteredNotices.map((notice, index) => (
                  <div key={notice.id} className="animate-in" style={{ animationDelay: `${index * 50}ms` }}>
                    <NoticeCard
                      notice={notice}
                      onClick={() => handleNoticeClick(notice)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="No notices found"
                description={
                  searchQuery
                    ? `No results match "${searchQuery}". Try different keywords or adjust your filters.`
                    : 'No notices match your current filters. Try adjusting your selection.'
                }
              />
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

      {/* Floating Chat Widget */}
      <FloatingChatWidget />

      <Footer />
    </div>
  );
}
