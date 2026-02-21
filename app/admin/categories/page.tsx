'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Edit, Plus, Tag, FileText } from 'lucide-react';
import { MOCK_CATEGORIES, CategoryConfig } from '@/lib/admin-mock-data';

export default function CategoriesManagement() {
  const [categories, setCategories] = useState<CategoryConfig[]>(MOCK_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleCategory = (categoryId: string) => {
    setCategories(categories.map(cat =>
      cat.id === categoryId ? { ...cat, enabled: !cat.enabled } : cat
    ));
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Notice Categories</h1>
            <p className="text-muted-foreground">Configure categories and AI classification labels</p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        </div>

        {/* Search */}
        <Input
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Total Categories</p>
            <p className="text-2xl font-bold text-foreground">{categories.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Active</p>
            <p className="text-2xl font-bold text-green-600">
              {categories.filter(c => c.enabled).length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-1">Total Notices</p>
            <p className="text-2xl font-bold text-foreground">
              {categories.reduce((acc, c) => acc + c.noticeCount, 0)}
            </p>
          </Card>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCategories.map((category) => (
            <Card key={category.id} className="p-6">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${category.color}20` }}
                    >
                      <Tag className="w-5 h-5" style={{ color: category.color }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{category.name}</h3>
                      <p className="text-sm text-muted-foreground">{category.slug}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {category.description}
                </p>

                {/* Keywords */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">AI Keywords</Label>
                  <div className="flex flex-wrap gap-2">
                    {category.aiKeywords.map((keyword, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Stats & Toggle */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{category.noticeCount} notices</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`toggle-${category.id}`} className="text-sm">
                      {category.enabled ? 'Enabled' : 'Disabled'}
                    </Label>
                    <Switch
                      id={`toggle-${category.id}`}
                      checked={category.enabled}
                      onCheckedChange={() => toggleCategory(category.id)}
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
