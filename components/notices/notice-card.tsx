'use client';

import { Notice, CATEGORY_COLORS } from '@/lib/mock-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/language-context';
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
  Calendar,
  ArrowRight,
  AlertTriangle,
  Timer,
  CalendarCheck,
} from 'lucide-react';
import { useState } from 'react';

interface NoticeCardProps {
  notice: Notice;
  onClick?: () => void;
}

export function NoticeCard({ notice, onClick }: NoticeCardProps) {
  const [isSaved, setIsSaved] = useState(false);
  const { t, language } = useLanguage();

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(language === 'ne' ? 'ne-NP' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatShortDate = (date: Date) => {
    return new Date(date).toLocaleDateString(language === 'ne' ? 'ne-NP' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getCategoryIcon = (category: string) => {
    const iconClass = "w-5 h-5";
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

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'exams': return t('card.examNotice');
      case 'vacancies': return t('card.jobVacancy');
      case 'tenders': return t('card.tenderNotice');
      case 'policy': return t('card.policyUpdate');
      case 'announcements': return t('card.announcement');
      default: return t('card.notice');
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'high':
        return {
          classes: 'bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/15 dark:text-red-400 dark:border-red-400/20',
          label: t('card.highPriority'),
        };
      case 'normal':
        return {
          classes: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-400/20',
          label: t('card.normal'),
        };
      case 'low':
        return {
          classes: 'bg-muted text-muted-foreground border-border',
          label: t('card.lowPriority'),
        };
      default:
        return { classes: '', label: '' };
    }
  };

  const now = new Date();
  const daysUntilDeadline = notice.deadline 
    ? Math.ceil((new Date(notice.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) 
    : null;
  const isExpired = daysUntilDeadline !== null && daysUntilDeadline < 0;
  const isUrgent = daysUntilDeadline !== null && daysUntilDeadline <= 7 && daysUntilDeadline > 0;
  const isDueToday = daysUntilDeadline === 0;

  const getDeadlineStatus = () => {
    if (!notice.deadline) return null;
    if (isExpired) return { label: t('card.expired'), color: 'text-muted-foreground', bgColor: 'bg-muted', icon: Clock };
    if (isDueToday) return { label: t('card.dueToday'), color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/10 dark:bg-red-500/15', icon: AlertTriangle };
    if (isUrgent) return { label: `${daysUntilDeadline} ${daysUntilDeadline! > 1 ? t('card.daysLeft') : t('card.dayLeft')}`, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-500/10 dark:bg-orange-500/15', icon: Timer };
    return { label: `${t('card.due')} ${formatShortDate(notice.deadline)}`, color: 'text-muted-foreground', bgColor: 'bg-muted/50', icon: Calendar };
  };

  const deadlineStatus = getDeadlineStatus();
  const priorityConfig = getPriorityConfig(notice.priority);

  // Extract key info summary based on category
  const getKeySummary = () => {
    const summaryItems: string[] = [];

    if (notice.category === 'exams') {
      const dateMatch = notice.content.match(/(?:exam\s*date|date)[:\s]*([^\n,]+)/i);
      if (dateMatch) summaryItems.push(dateMatch[1].trim());
    }
    if (notice.category === 'vacancies') {
      const posMatch = notice.content.match(/(\d+)\s*positions?/i);
      if (posMatch) summaryItems.push(`${posMatch[1]} ${t('card.positions')}`);
    }
    if (notice.category === 'tenders') {
      const idMatch = notice.content.match(/tender\s*id[:\s]*([^\n]+)/i);
      if (idMatch) summaryItems.push(idMatch[1].trim());
    }

    return summaryItems;
  };

  const keySummary = getKeySummary();

  return (
    <Card
      className={`group relative overflow-hidden border border-border/60 hover:border-primary/40 bg-card hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer ${isExpired ? 'opacity-70' : ''}`}
      onClick={onClick}
    >
      {/* Top urgency strip */}
      {(isUrgent || isDueToday) && (
        <div className={`h-1 w-full ${isDueToday ? 'bg-red-500' : 'bg-orange-500'}`} />
      )}

      <div className="p-4 sm:p-5">
        {/* Row 1: Category + Priority + Deadline Status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={`text-xs font-medium gap-1.5 ${CATEGORY_COLORS[notice.category]}`}>
              {getCategoryIcon(notice.category)}
              {getCategoryLabel(notice.category)}
            </Badge>
            <Badge variant="outline" className={`text-xs font-medium ${priorityConfig.classes}`}>
              {priorityConfig.label}
            </Badge>
          </div>

          {deadlineStatus && (
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${deadlineStatus.bgColor} ${deadlineStatus.color}`}>
              <deadlineStatus.icon className="w-3.5 h-3.5" />
              <span>{deadlineStatus.label}</span>
            </div>
          )}
        </div>

        {/* Row 2: Organization */}
        {notice.organization && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-medium truncate">{notice.organization}</span>
          </div>
        )}

        {/* Row 3: Title */}
        <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug mb-2">
          {notice.title}
        </h3>

        {/* Row 4: Description / Summary */}
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-3">
          {notice.description}
        </p>

        {/* Row 5: Key Info Cards */}
        <div className="flex flex-wrap gap-2 mb-3">
          {notice.deadline && !isExpired && (
            <div className="inline-flex items-center gap-1.5 text-xs bg-muted/60 dark:bg-muted/40 text-foreground/80 px-2.5 py-1.5 rounded-md border border-border/40">
              <CalendarCheck className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-medium">{t('card.deadline')}: {formatDate(notice.deadline)}</span>
            </div>
          )}
          {notice.attachments.length > 0 && (
            <div className="inline-flex items-center gap-1.5 text-xs bg-muted/60 dark:bg-muted/40 text-foreground/80 px-2.5 py-1.5 rounded-md border border-border/40">
              <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-medium">{notice.attachments.length} {notice.attachments.length > 1 ? t('card.attachments') : t('card.attachment')}</span>
            </div>
          )}
          {keySummary.length > 0 && keySummary.map((item, i) => (
            <div key={i} className="inline-flex items-center gap-1.5 text-xs bg-muted/60 dark:bg-muted/40 text-foreground/80 px-2.5 py-1.5 rounded-md border border-border/40">
              <span className="font-medium">{item}</span>
            </div>
          ))}
        </div>

        {/* Row 6: Footer - Meta + Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium">{notice.author}</span>
            <span className="text-border">|</span>
            <span>{formatDate(notice.publishedDate)}</span>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              <span>{notice.views.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
            <div className="hidden sm:flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              <span>{t('card.viewDetails')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
