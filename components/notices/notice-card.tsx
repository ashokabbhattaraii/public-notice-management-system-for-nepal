'use client';

import { Notice, CATEGORY_COLORS } from '@/lib/mock-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, FileText, Heart, Clock, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface NoticeCardProps {
  notice: Notice;
  onClick?: () => void;
}

export function NoticeCard({ notice, onClick }: NoticeCardProps) {
  const [isSaved, setIsSaved] = useState(false);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      case 'normal':
        return 'bg-primary/10 text-primary';
      case 'low':
        return 'bg-muted text-muted-foreground';
      default:
        return '';
    }
  };

  const daysUntilDeadline = notice.deadline ? Math.ceil((notice.deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isUrgent = daysUntilDeadline && daysUntilDeadline <= 7 && daysUntilDeadline > 0;

  return (
    <Card
      className="p-4 sm:p-6 hover:shadow-lg transition-all cursor-pointer group border border-border hover:border-primary/50"
      onClick={onClick}
    >
      <div className="flex gap-4 flex-col sm:flex-row">
        {/* Category Icon/Badge */}
        <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${CATEGORY_COLORS[notice.category]} group-hover:scale-110 transition-transform`}>
          {notice.category === 'exams' && '📝'}
          {notice.category === 'vacancies' && '💼'}
          {notice.category === 'tenders' && '🏢'}
          {notice.category === 'policy' && '📋'}
          {notice.category === 'announcements' && '📢'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Organization Badge */}
          {notice.organization && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
              <Building2 className="w-3 h-3" />
              <span className="font-medium">{notice.organization}</span>
            </div>
          )}

          {/* Title and Priority */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <h3 className="text-base sm:text-lg font-semibold text-foreground group-hover:text-primary transition line-clamp-2">
                {notice.title}
              </h3>
            </div>
            <Badge className={`flex-shrink-0 capitalize text-xs ${getPriorityColor(notice.priority)}`}>
              {notice.priority === 'high' ? '🔴 ' : ''}{notice.priority}
            </Badge>
          </div>

          {/* Category & Metadata Badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="secondary" className="capitalize text-xs">
              {notice.category}
            </Badge>
            {isUrgent && (
              <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-xs">
                ⚡ Deadline Soon
              </Badge>
            )}
            {notice.attachments.length > 0 && (
              <Badge variant="outline" className="text-xs">
                📎 {notice.attachments.length} file{notice.attachments.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {notice.description}
          </p>

          {/* Deadline and Footer */}
          <div className="flex flex-col gap-3">
            {notice.deadline && (
              <div className="flex items-center gap-2 text-xs">
                <Clock className="w-4 h-4 text-orange-500" />
                <span className="font-medium">
                  {daysUntilDeadline && daysUntilDeadline > 0 
                    ? `Deadline in ${daysUntilDeadline} day${daysUntilDeadline > 1 ? 's' : ''}`
                    : `Deadline: ${formatDate(notice.deadline)}`
                  }
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground border-t border-border pt-3">
              <div className="flex flex-wrap gap-2">
                <span>{notice.author}</span>
                <span>•</span>
                <span>{formatDate(notice.publishedDate)}</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  <span>{notice.views}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSaved(!isSaved);
                  }}
                  className={isSaved ? 'text-primary' : 'text-muted-foreground hover:text-primary'}
                >
                  <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
