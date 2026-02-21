'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/language-context';
import { useAlerts, type AlertRule } from '@/lib/alerts-context';
import { AlertSetupDialog } from './alert-setup-dialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Empty } from '@/components/ui/empty';
import {
  Bell,
  Plus,
  Pencil,
  Trash2,
  Tag,
  Building2,
  AlertTriangle,
  Search,
} from 'lucide-react';

export function AlertsManager() {
  const { t } = useLanguage();
  const { alerts, toggleAlert, deleteAlert, getMatchingNotices } = useAlerts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AlertRule | null>(null);

  const handleEdit = (alert: AlertRule) => {
    setEditingAlert(alert);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingAlert(null);
    setDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">{t('alerts.title')}</h2>
        </div>
        <Button size="sm" onClick={handleCreate} className="gap-1.5">
          <Plus className="w-4 h-4" />
          {t('alerts.setup')}
        </Button>
      </div>

      {alerts.length === 0 ? (
        <Empty
          title={t('alerts.noAlerts')}
          description={t('alerts.noAlertsDesc')}
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const matchCount = getMatchingNotices(alert).length;
            return (
              <Card
                key={alert.id}
                className={`p-4 border transition-all ${
                  alert.enabled
                    ? 'border-border hover:border-primary/40'
                    : 'border-border/50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground truncate">{alert.name}</h3>
                      {alert.enabled && matchCount > 0 && (
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                          {matchCount} {matchCount === 1 ? t('alerts.matchingNotice') : t('alerts.matchingNotices')}
                        </Badge>
                      )}
                    </div>

                    {/* Criteria summary */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {alert.categories.length > 0 && (
                        <div className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                          <Tag className="w-3 h-3" />
                          {alert.categories.length} {t('alerts.categories').toLowerCase()}
                        </div>
                      )}
                      {alert.organizations.length > 0 && (
                        <div className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                          <Building2 className="w-3 h-3" />
                          {alert.organizations.length} {t('alerts.organizations').toLowerCase()}
                        </div>
                      )}
                      {alert.priorities.length > 0 && (
                        <div className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3" />
                          {alert.priorities.length} {t('alerts.priorities').toLowerCase()}
                        </div>
                      )}
                      {alert.keywords && (
                        <div className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                          <Search className="w-3 h-3" />
                          {alert.keywords.split(',').filter(Boolean).length} {t('alerts.keywords').toLowerCase()}
                        </div>
                      )}
                      {alert.categories.length === 0 && alert.organizations.length === 0 && alert.priorities.length === 0 && !alert.keywords && (
                        <span className="text-xs text-muted-foreground italic">{t('alerts.allCategories')}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Switch
                      checked={alert.enabled}
                      onCheckedChange={() => toggleAlert(alert.id)}
                      aria-label={alert.enabled ? t('alerts.enabled') : t('alerts.disabled')}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 pt-2 border-t border-border/40">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(alert)}
                    className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {t('alerts.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAlert(alert.id)}
                    className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('alerts.delete')}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AlertSetupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingAlert={editingAlert}
      />
    </div>
  );
}
