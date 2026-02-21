'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/language-context';
import { useAlerts } from '@/lib/alerts-context';
import { useAuth } from '@/lib/auth-context';
import { AlertSetupDialog } from './alert-setup-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellRing, ChevronRight, Settings } from 'lucide-react';
import Link from 'next/link';

export function AlertCtaBanner() {
  const { t } = useLanguage();
  const { alerts, matchedCount } = useAlerts();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  const activeAlerts = alerts.filter((a) => a.enabled).length;

  // Compact bar for users who already have alerts
  if (alerts.length > 0) {
    return (
      <>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BellRing className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {activeAlerts} {t('alerts.activeCount')}
                </span>
                {matchedCount > 0 && (
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20">
                    {matchedCount} {t('alerts.matchedNotices')}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('alerts.ctaDesc')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialogOpen(true)}
              className="gap-1.5"
            >
              <Bell className="w-3.5 h-3.5" />
              {t('alerts.setup')}
            </Button>
            {user && (
              <Button size="sm" variant="ghost" asChild className="gap-1.5">
                <Link href="/dashboard">
                  <Settings className="w-3.5 h-3.5" />
                  {t('alerts.ctaManage')}
                </Link>
              </Button>
            )}
          </div>
        </div>

        <AlertSetupDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editingAlert={null}
        />
      </>
    );
  }

  // Prominent CTA for new users / no alerts
  return (
    <>
      <div className="relative rounded-xl overflow-hidden border border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5" />
        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Bell className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1 text-balance">
                {t('alerts.ctaTitle')}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
                {t('alerts.ctaDesc')}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-gradient-to-r from-primary to-secondary hover:shadow-lg transition-all duration-300 gap-1.5 flex-shrink-0"
          >
            {t('alerts.ctaButton')}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <AlertSetupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingAlert={null}
      />
    </>
  );
}
