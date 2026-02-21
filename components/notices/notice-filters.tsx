'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface NoticeFiltersProps {
  onSearch: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onPriorityChange: (priority: string) => void;
  selectedCategory: string;
  selectedPriority: string;
  searchQuery: string;
}

const CATEGORIES = [
  { value: 'exams', label: 'Exams', icon: '📝' },
  { value: 'vacancies', label: 'Vacancies & Admissions', icon: '💼' },
  { value: 'tenders', label: 'Tenders', icon: '🏢' },
  { value: 'policy', label: 'Policy Updates', icon: '📋' },
  { value: 'announcements', label: 'Announcements', icon: '📢' },
];

const PRIORITIES = [
  { value: 'high', label: 'High Priority', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  { value: 'low', label: 'Low Priority', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
];

export function NoticeFilters({
  onSearch,
  onCategoryChange,
  onPriorityChange,
  selectedCategory,
  selectedPriority,
  searchQuery,
}: NoticeFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [expandedSections, setExpandedSections] = useState({
    search: true,
    category: true,
    priority: true,
  });

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

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const hasActiveFilters = selectedCategory !== 'all' || selectedPriority !== 'all' || searchQuery;

  return (
    <Card className="bg-card border border-border p-0 sticky top-20">
      <div className="space-y-1">
        {/* Search Section */}
        <div className="border-b border-border">
          <button
            onClick={() => toggleSection('search')}
            className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
          >
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Search className="w-4 h-4" />
              Search
            </h3>
            {expandedSections.search ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {expandedSections.search && (
            <div className="px-4 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title or content..."
                  className="pl-10 text-sm"
                  value={localSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              {localSearch && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>

        {/* Category Section */}
        <div className="border-b border-border">
          <button
            onClick={() => toggleSection('category')}
            className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
          >
            <h3 className="font-semibold text-sm text-foreground">Categories</h3>
            {expandedSections.category ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {expandedSections.category && (
            <div className="px-4 pb-4 space-y-3">
              <button
                onClick={() => onCategoryChange('all')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-muted text-foreground'
                }`}
              >
                All Categories
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => onCategoryChange(cat.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    selectedCategory === cat.value
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Priority Section */}
        <div className="border-b border-border">
          <button
            onClick={() => toggleSection('priority')}
            className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
          >
            <h3 className="font-semibold text-sm text-foreground">Priority</h3>
            {expandedSections.priority ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {expandedSections.priority && (
            <div className="px-4 pb-4 space-y-3">
              <button
                onClick={() => onPriorityChange('all')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedPriority === 'all'
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-muted text-foreground'
                }`}
              >
                All Priorities
              </button>
              {PRIORITIES.map(pri => (
                <button
                  key={pri.value}
                  onClick={() => onPriorityChange(pri.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    selectedPriority === pri.value
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${pri.color.split(' ')[0]}`}></div>
                  <span>{pri.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <div className="p-4 border-t border-border">
            <Button
              variant="outline"
              onClick={handleReset}
              className="w-full text-sm"
            >
              <X className="w-4 h-4 mr-2" />
              Clear All Filters
            </Button>
          </div>
        )}

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="px-4 pb-4 pt-2 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground font-medium mb-2">Active Filters:</p>
            <div className="flex flex-wrap gap-2">
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                  Search: "{searchQuery}"
                  <button onClick={() => handleSearchChange('')} className="hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedCategory !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                  {CATEGORIES.find(c => c.value === selectedCategory)?.label}
                  <button onClick={() => onCategoryChange('all')} className="hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedPriority !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                  {PRIORITIES.find(p => p.value === selectedPriority)?.label}
                  <button onClick={() => onPriorityChange('all')} className="hover:opacity-70">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
