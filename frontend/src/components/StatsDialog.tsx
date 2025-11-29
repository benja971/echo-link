import { Copy, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { UserStats, GlobalStats, StatsTab } from '@/types'

interface StatsDialogProps {
  isOpen: boolean
  onClose: () => void
  userStats: UserStats | null
  globalStats: GlobalStats | null
  activeTab: StatsTab
  onTabChange: (tab: StatsTab) => void
  onCopyLink: (url: string) => void
  formatFileSize: (bytes: number) => string
}

export function StatsDialog({
  isOpen,
  onClose,
  userStats,
  globalStats,
  activeTab,
  onTabChange,
  onCopyLink,
  formatFileSize
}: StatsDialogProps) {
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold">Statistiques</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border p-4">
          <Button
            variant={activeTab === 'user' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onTabChange('user')}
          >
            Mon espace
          </Button>
          <Button
            variant={activeTab === 'global' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onTabChange('global')}
          >
            Global
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* User Stats */}
          {activeTab === 'user' && userStats && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fichiers</span>
                    <span>{userStats.quota.files.used} / {userStats.quota.files.max}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.min(userStats.quota.files.percentage, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stockage</span>
                    <span>{formatFileSize(userStats.quota.storage.usedBytes)} / {formatFileSize(userStats.quota.storage.maxBytes)}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.min(userStats.quota.storage.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {userStats.recentFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm text-muted-foreground">Mes fichiers récents</h4>
                  <div className="space-y-1">
                    {userStats.recentFiles.slice(0, 10).map(file => (
                      <div key={file.id} className="flex items-center justify-between text-sm py-2 hover:bg-secondary/50 rounded px-2">
                        <span className="truncate flex-1 mr-2">{file.title}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => onCopyLink(file.shareUrl)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Global Stats */}
          {activeTab === 'global' && globalStats && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <div className="text-2xl font-bold">{globalStats.totals.users}</div>
                  <div className="text-xs text-muted-foreground">Utilisateurs</div>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <div className="text-2xl font-bold">{globalStats.totals.files}</div>
                  <div className="text-xs text-muted-foreground">Fichiers</div>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <div className="text-2xl font-bold">{formatFileSize(globalStats.totals.storageBytes)}</div>
                  <div className="text-xs text-muted-foreground">Stockage total</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="space-y-1 p-3 bg-secondary/30 rounded-lg">
                  <div className="text-muted-foreground">Aujourd'hui</div>
                  <div>{globalStats.today.files} fichiers</div>
                  <div className="text-muted-foreground">{formatFileSize(globalStats.today.storageBytes)}</div>
                </div>
                <div className="space-y-1 p-3 bg-secondary/30 rounded-lg">
                  <div className="text-muted-foreground">Cette semaine</div>
                  <div>{globalStats.thisWeek.files} fichiers</div>
                  <div className="text-muted-foreground">{formatFileSize(globalStats.thisWeek.storageBytes)}</div>
                </div>
                <div className="space-y-1 p-3 bg-secondary/30 rounded-lg">
                  <div className="text-muted-foreground">Ce mois</div>
                  <div>{globalStats.thisMonth.files} fichiers</div>
                  <div className="text-muted-foreground">{formatFileSize(globalStats.thisMonth.storageBytes)}</div>
                </div>
              </div>

              {globalStats.recentFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm text-muted-foreground">Derniers fichiers (plateforme)</h4>
                  <div className="space-y-1">
                    {globalStats.recentFiles.slice(0, 10).map(file => (
                      <div key={file.id} className="flex items-center justify-between text-sm py-2 hover:bg-secondary/50 rounded px-2">
                        <span className="truncate flex-1 mr-2">{file.title}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => onCopyLink(file.shareUrl)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
