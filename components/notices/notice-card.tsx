'use client';

import { Notice, CATEGORY_COLORS } from '@/lib/mock-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, FileText, Heart } from 'lucide-react';
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
        return 'bg-destructive/10 text-destructive';
      case 'normal':
        return 'bg-primary/10 text-primary';
      case 'low':
        return 'bg-muted text-muted-foreground';
      default:
        return '';
    }
  };

  return (
    <Card
      className="p-4 sm:p-6 hover:shadow-lg transition-shadow cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex gap-4 flex-col sm:flex-row">
        {/* Category Icon/Badge */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${CATEGORY_COLORS[notice.category]}`}>
          <FileText className="w-6 h-6" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title and Priority */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <h3 className="text-base sm:text-lg font-semibold text-foreground group-hover:text-primary transition line-clamp-2">
                {notice.title}
              </h3>
            </div>
            <Badge className={`flex-shrink-0 ${getPriorityColor(notice.priority)}`}>
              {notice.priority}
            </Badge>
          </div>

          {/* Category Badge */}
          <div className="flex gap-2 mb-3">
            <Badge variant="secondary" className="capitalize text-xs">
              {notice.category}
            </Badge>
            {notice.attachments.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {notice.attachments.length} files
              </Badge>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {notice.description}
          </p>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-3">
              <span>By {notice.author}</span>
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
                className={isSaved ? 'text-primary' : 'text-muted-foreground'}
              >
                <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
