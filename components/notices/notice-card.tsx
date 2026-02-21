'use client';

import { Notice, CATEGORY_COLORS } from '@/lib/mock-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Eye, 
  Heart, 
  Clock, 
  Building2, 
  FileText, 
  Briefcase, 
  GraduationCap, 
  Megaphone, 
  FileCheck,
  Paperclip,
  Calendar
} from 'lucide-react';
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

  const getCategoryIcon = (category: string) => {
    const iconClass = "w-6 h-6";
    switch (category) {
      case 'exams':
        return <GraduationCap className={iconClass} />;
      case 'vacancies':
        return <Briefcase className={iconClass} />;
      case 'tenders':
        return <FileCheck className={iconClass} />;
      case 'policy':
        return <FileText className={iconClass} />;
      case 'announcements':
        return <Megaphone className={iconClass} />;
      default:
        return <FileText className={iconClass} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/20 dark:text-red-400';
      case 'normal':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400';
      case 'low':
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20 dark:bg-gray-500/20 dark:text-gray-400';
      default:
        return '';
    }
  };

  const daysUntilDeadline = notice.deadline ? Math.ceil((notice.deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isUrgent = daysUntilDeadline && daysUntilDeadline <= 7 && daysUntilDeadline > 0;

  return (
    <Card
      className="p-5 hover:shadow-lg transition-all duration-200 cursor-pointer group border border-border/60 hover:border-primary/50 bg-card"
      onClick={onClick}
    >
      <div className="flex gap-4">
        {/* Category Icon */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${CATEGORY_COLORS[notice.category]} group-hover:scale-105 transition-transform duration-200`}>
          {getCategoryIcon(notice.category)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Organization */}
          {notice.organization && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
              <Building2 className="w-3.5 h-3.5" />
              <span className="font-medium">{notice.organization}</span>
            </div>
          )}

          {/* Title and Priority */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
              {notice.title}
            </h3>
            <Badge 
              variant="outline"
              className={`flex-shrink-0 capitalize text-xs font-medium ${getPriorityColor(notice.priority)}`}
            >
              {notice.priority}
            </Badge>
          </div>

          {/* Category & Metadata Badges */}
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="secondary" className="capitalize text-xs font-medium">
              {notice.category}
            </Badge>
            {isUrgent && (
              <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs font-medium dark:bg-orange-500/20 dark:text-orange-400">
                <Clock className="w-3 h-3 mr-1" />
                Urgent
              </Badge>
            )}
            {notice.attachments.length > 0 && (
              <Badge variant="outline" className="text-xs font-medium">
                <Paperclip className="w-3 h-3 mr-1" />
                {notice.attachments.length}
              </Badge>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
            {notice.description}
          </p>

          {/* Footer */}
          <div className="flex flex-col gap-2.5">
            {/* Deadline */}
            {notice.deadline && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span className="font-medium">
                  {daysUntilDeadline && daysUntilDeadline > 0 
                    ? `Due in ${daysUntilDeadline} day${daysUntilDeadline > 1 ? 's' : ''}`
                    : formatDate(notice.deadline)
                  }
                </span>
              </div>
            )}

            {/* Meta Info */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2.5 border-t border-border/50">
              <div className="flex items-center gap-2">
                <span className="font-medium">{notice.author}</span>
                <span>•</span>
                <span>{formatDate(notice.publishedDate)}</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  <span className="font-medium">{notice.views}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSaved(!isSaved);
                  }}
                  className={`h-7 w-7 p-0 transition-colors ${isSaved ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-red-500'}`}
                >
                  <Heart className={`w-4 h-4 transition-all ${isSaved ? 'fill-current' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
