import { Link2, BarChart3, LogOut, Grid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

interface HeaderProps {
  email: string
  showGallery: boolean
  showStats: boolean
  onToggleGallery: () => void
  onToggleStats: () => void
  onLogout: () => void
}

export function Header({
  email,
  showGallery,
  showStats,
  onToggleGallery,
  onToggleStats,
  onLogout
}: HeaderProps) {
  return (
    <CardHeader className="space-y-1 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Link2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Echo Link
            </CardTitle>
            <CardDescription className="text-base mt-1">
              {email}
            </CardDescription>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleGallery}
            title="Galerie"
            className={showGallery ? 'bg-secondary' : ''}
          >
            <Grid className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleStats}
            title="Statistiques"
            className={`onboarding-stats-button ${showStats ? 'bg-secondary' : ''}`}
          >
            <BarChart3 className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            title="Déconnexion"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </CardHeader>
  )
}
