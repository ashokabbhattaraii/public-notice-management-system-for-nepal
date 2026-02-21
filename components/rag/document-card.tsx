'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download, Eye } from 'lucide-react';

interface DocumentCardProps {
  id: string;
  title: string;
  category: string;
  uploadedDate: Date;
  size: string;
  views: number;
  onClick?: () => void;
}

export function DocumentCard({
  id,
  title,
  category,
  uploadedDate,
  size,
  views,
  onClick,
}: DocumentCardProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      handbooks: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      guides: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      academic: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      financial: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    };
    return colors[cat] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  };

  return (
    <Card
      className="p-4 hover:shadow-lg transition-shadow cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex gap-4">
        {/* Icon */}
        <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${getCategoryColor(category)}`}>
          <FileText className="w-6 h-6" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition line-clamp-2">
            {title}
          </h3>
          <div className="flex items-center gap-2 mt-2 mb-3">
            <Badge variant="secondary" className="text-xs capitalize">
              {category}
            </Badge>
            <span className="text-xs text-muted-foreground">{size}</span>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatDate(uploadedDate)}</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {views}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="h-8 px-2"
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
