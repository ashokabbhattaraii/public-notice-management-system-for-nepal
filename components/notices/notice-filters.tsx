'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, GraduationCap, Briefcase, FileCheck, FileText, Megaphone, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '@/lib/language-context';

interface NoticeFiltersProps {
  onSearch: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onPriorityChange: (priority: string) => void;
  selectedCategory: string;
  selectedPriority: string;
  searchQuery: string;
}

export function NoticeFilters({
  onSearch,
  onCategoryChange,
  onPriorityChange,
  selectedCategory,
  selectedPriority,
  searchQuery,
}: NoticeFiltersProps) {
  const { t } = useLanguage();
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const CATEGORIES = [
    { value: 'exams', labelKey: 'category.exams', Icon: GraduationCap },
    { value: 'vacancies', labelKey: 'category.vacancies', Icon: Briefcase },
    { value: 'tenders', labelKey: 'category.tenders', Icon: FileCheck },
    { value: 'policy', labelKey: 'category.policy', Icon: FileText },
    { value: 'announcements', labelKey: 'category.announcements', Icon: Megaphone },
  ];

  const PRIORITIES = [
    { value: 'high', labelKey: 'filters.highPriority' },
    { value: 'normal', labelKey: 'filters.normal' },
    { value: 'low', labelKey: 'filters.lowPriority' },
  ];

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    onSearch(value);
  };

  const handleReset = () => {
    setLocalSearch('');
    onSearch('');
    onCategoryChange('all');
    onPriorityChange('all');
  };

  const hasActiveFilters = selectedCategory !== 'all' || selectedPriority !== 'all' || searchQuery;

  return (
    <div className="space-y-4">
      {/* Main Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={t('filters.searchPlaceholder')}
          className="pl-12 pr-4 py-3 h-12 rounded-lg border-border/60 focus:border-primary/50 transition-all"
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        {localSearch && (
          <button
            onClick={() => handleSearchChange('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Section */}
      <div className="space-y-3">
        {/* Category Filters */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2.5 block">{t('filters.category')}</label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onCategoryChange('all')}
              className="h-9 rounded-lg"
            >
              {t('filters.allCategories')}
            </Button>
            {CATEGORIES.map(cat => {
              const Icon = cat.Icon;
              return (
                <Button
                  key={cat.value}
                  variant={selectedCategory === cat.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onCategoryChange(cat.value)}
                  className="h-9 rounded-lg gap-2"
                >
                  <Icon className="w-4 h-4" />
                  <span>{t(cat.labelKey)}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Priority Filters */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2.5 block">{t('filters.priority')}</label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedPriority === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPriorityChange('all')}
              className="h-9 rounded-lg"
            >
              {t('filters.allPriorities')}
            </Button>
            {PRIORITIES.map(pri => (
              <Button
                key={pri.value}
                variant={selectedPriority === pri.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPriorityChange(pri.value)}
                className="h-9 rounded-lg capitalize"
              >
                <AlertCircle className="w-4 h-4 mr-1.5" />
                {t(pri.labelKey)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          onClick={handleReset}
          className="w-full text-sm hover:bg-muted"
        >
          <X className="w-4 h-4 mr-2" />
          {t('filters.clearAll')}
        </Button>
      )}
    </div>
  );
}
