'use client';

import { Notice, CATEGORY_COLORS } from '@/lib/mock-data';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Download, Heart, Share2, X } from 'lucide-react';
import { useState } from 'react';

interface NoticeDetailModalProps {
  notice: Notice | null;
  isOpen: boolean;
  onClose: () => void;
}

export function NoticeDetailModal({ notice, isOpen, onClose }: NoticeDetailModalProps) {
  const [isSaved, setIsSaved] = useState(false);

  if (!notice) return null;

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <DialogTitle className="text-2xl text-foreground mb-3">
                {notice.title}
              </DialogTitle>
              <div className="flex flex-wrap gap-2">
                <Badge
                  className={`capitalize ${CATEGORY_COLORS[notice.category]}`}
                >
                  {notice.category}
                </Badge>
                <Badge variant="outline">{notice.priority} priority</Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="pr-4 space-y-6">
            {/* Meta Information */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground font-medium">Published</p>
                <p className="text-foreground">{formatDate(notice.publishedDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Last Updated</p>
                <p className="text-foreground">{formatDate(notice.lastUpdated)}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Author</p>
                <p className="text-foreground">{notice.author}</p>
              </div>
              <div>
                <p className="text-muted-foreground font-medium">Views</p>
                <p className="text-foreground">{notice.views.toLocaleString()}</p>
              </div>
            </div>

            {/* Main Content */}
            <div className="border-t border-border pt-6">
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Details
              </h2>
              <div className="text-foreground whitespace-pre-wrap leading-relaxed text-sm">
                {notice.content}
              </div>
            </div>

            {/* Attachments */}
            {notice.attachments.length > 0 && (
              <div className="border-t border-border pt-6">
                <h2 className="text-lg font-semibold text-foreground mb-3">
                  Attachments
                </h2>
                <div className="space-y-2">
                  {notice.attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                        <span className="text-sm text-foreground truncate">
                          {attachment.name}
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" className="flex-shrink-0">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Action Buttons */}
        <div className="border-t border-border pt-4 flex gap-2">
          <Button
            variant={isSaved ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setIsSaved(!isSaved)}
          >
            <Heart className={`w-4 h-4 mr-2 ${isSaved ? 'fill-current' : ''}`} />
            {isSaved ? 'Saved' : 'Save'}
          </Button>
          <Button variant="outline" className="flex-1">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
