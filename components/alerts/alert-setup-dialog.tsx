'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/language-context';
import { useAlerts, type AlertRule } from '@/lib/alerts-context';
import { MOCK_NOTICES } from '@/lib/mock-data';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  GraduationCap,
  Briefcase,
  FileCheck,
  FileText,
  Megaphone,
  X,
} from 'lucide-react';

interface AlertSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAlert?: AlertRule | null;
}

const CATEGORIES = [
  { id: 'exams', icon: GraduationCap },
  { id: 'vacancies', icon: Briefcase },
  { id: 'tenders', icon: FileCheck },
  { id: 'policy', icon: FileText },
  { id: 'announcements', icon: Megaphone },
];

const PRIORITIES = ['high', 'normal', 'low'];

export function AlertSetupDialog({ open, onOpenChange, editingAlert }: AlertSetupDialogProps) {
  const { t } = useLanguage();
  const { addAlert, updateAlert } = useAlerts();

  const uniqueOrgs = Array.from(new Set(MOCK_NOTICES.map((n) => n.organization)));

  const [name, setName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [keywords, setKeywords] = useState('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (editingAlert) {
      setName(editingAlert.name);
      setSelectedCategories(editingAlert.categories);
      setSelectedOrganizations(editingAlert.organizations);
      setSelectedPriorities(editingAlert.priorities);
      setKeywords(editingAlert.keywords);
      setEnabled(editingAlert.enabled);
    } else {
      setName('');
      setSelectedCategories([]);
      setSelectedOrganizations([]);
      setSelectedPriorities([]);
      setKeywords('');
      setEnabled(true);
    }
  }, [editingAlert, open]);

  const toggleItem = (list: string[], item: string) => {
    return list.includes(item)
      ? list.filter((i) => i !== item)
      : [...list, item];
  };

  const getCategoryLabel = (id: string) => {
    const key = `category.${id}`;
    const translated = t(key);
    return translated !== key ? translated : id;
  };

  const getPriorityLabel = (p: string) => {
    switch (p) {
      case 'high': return t('card.highPriority');
      case 'normal': return t('card.normal');
      case 'low': return t('card.lowPriority');
      default: return p;
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      categories: selectedCategories,
      organizations: selectedOrganizations,
      priorities: selectedPriorities,
      keywords,
      enabled,
    };
    if (editingAlert) {
      updateAlert(editingAlert.id, payload);
    } else {
      addAlert(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingAlert ? t('alerts.edit') : t('alerts.setup')}</DialogTitle>
          <DialogDescription>
            {editingAlert ? t('alerts.edit') : t('alerts.ctaDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Alert Name */}
          <div className="space-y-2">
            <Label htmlFor="alert-name" className="text-sm font-medium">
              {t('alerts.name')}
            </Label>
            <Input
              id="alert-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('alerts.namePlaceholder')}
            />
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('alerts.categories')}</Label>
            <p className="text-xs text-muted-foreground">{t('alerts.selectCategories')}</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategories(toggleItem(selectedCategories, cat.id))}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {getCategoryLabel(cat.id)}
                  </button>
                );
              })}
            </div>
            {selectedCategories.length === 0 && (
              <p className="text-xs text-muted-foreground italic">{t('alerts.allCategories')}</p>
            )}
          </div>

          {/* Organizations */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('alerts.organizations')}</Label>
            <p className="text-xs text-muted-foreground">{t('alerts.selectOrganizations')}</p>
            <div className="flex flex-wrap gap-2">
              {uniqueOrgs.map((org) => {
                const isSelected = selectedOrganizations.includes(org);
                return (
                  <button
                    key={org}
                    type="button"
                    onClick={() => setSelectedOrganizations(toggleItem(selectedOrganizations, org))}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    {org}
                    {isSelected && <X className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
            {selectedOrganizations.length === 0 && (
              <p className="text-xs text-muted-foreground italic">{t('alerts.allOrganizations')}</p>
            )}
          </div>

          {/* Priorities */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('alerts.priorities')}</Label>
            <p className="text-xs text-muted-foreground">{t('alerts.selectPriorities')}</p>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => {
                const isSelected = selectedPriorities.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPriorities(toggleItem(selectedPriorities, p))}
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    {getPriorityLabel(p)}
                  </button>
                );
              })}
            </div>
            {selectedPriorities.length === 0 && (
              <p className="text-xs text-muted-foreground italic">{t('alerts.allPriorities')}</p>
            )}
          </div>

          {/* Keywords */}
          <div className="space-y-2">
            <Label htmlFor="alert-keywords" className="text-sm font-medium">
              {t('alerts.keywords')}
            </Label>
            <Input
              id="alert-keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder={t('alerts.keywordsPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('alerts.keywordsHelp')}</p>
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="alert-enabled" className="text-sm font-medium cursor-pointer">
              {enabled ? t('alerts.enabled') : t('alerts.disabled')}
            </Label>
            <Switch
              id="alert-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('alerts.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {editingAlert ? t('alerts.update') : t('alerts.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
