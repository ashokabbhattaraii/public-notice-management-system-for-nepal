'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download, Eye, Check, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';

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
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const { t, language } = useLanguage();

  useEffect(() => {
    const embedStatus = localStorage.getItem(`doc-embed-${id}`);
    if (embedStatus === 'true') {
      setIsEmbedded(true);
    }
  }, [id]);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(language === 'ne' ? 'ne-NP' : 'en-US', {
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

  const toggleEmbed = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEmbedding(true);
    
    // Simulate embedding process
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const newState = !isEmbedded;
    setIsEmbedded(newState);
    localStorage.setItem(`doc-embed-${id}`, String(newState));
    setIsEmbedding(false);
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
          <div className="flex items-center gap-2 mt-2 mb-3 flex-wrap">
            <Badge variant="secondary" className="text-xs capitalize">
              {category}
            </Badge>
            {isEmbedded && (
              <Badge variant="default" className="text-xs">
                <Check className="w-3 h-3 mr-1" />
                {t('rag.embedded')}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{size}</span>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
            <span className="truncate">{formatDate(uploadedDate)}</span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {views}
              </span>
              <Button
                size="sm"
                variant={isEmbedded ? 'secondary' : 'default'}
                onClick={toggleEmbed}
                disabled={isEmbedding}
                className="h-7 px-2 text-xs"
              >
                {isEmbedding ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : isEmbedded ? (
                  t('rag.unembed')
                ) : (
                  t('rag.embed')
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="h-7 px-2"
              >
                <Download className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
