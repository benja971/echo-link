import { useState, useRef, useEffect } from 'react'
import { Upload, Link2, FileIcon, Copy, Check, X, Mail, Loader2, BarChart3, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Joyride, { STATUS } from 'react-joyride'
import type { CallBackProps, Step } from 'react-joyride'

interface UploadResponse {
  shareUrl: string
  directUrl?: string
}

interface UserStats {
  user: {
    id: string
    email: string
    createdAt: string
    lastLoginAt: string
  }
  quota: {
    files: { used: number; max: number; percentage: number }
    storage: { usedBytes: number; maxBytes: number; percentage: number }
  }
  recentFiles: {
    id: string
    title: string
    mimeType: string
    sizeBytes: number
    createdAt: string
    shareUrl: string
  }[]
}

interface GlobalStats {
  totals: {
    users: number
    files: number
    storageBytes: number
  }
  today: {
    files: number
    storageBytes: number
  }
  thisWeek: {
    files: number
    storageBytes: number
  }
  thisMonth: {
    files: number
    storageBytes: number
  }
  recentFiles: {
    id: string
    title: string
    mimeType: string
    sizeBytes: number
    createdAt: string
    shareUrl: string
  }[]
}

type AuthState = 'checking' | 'unauthenticated' | 'waiting_email' | 'authenticated'
type StatsTab = 'user' | 'global'

const TOKEN_KEY = 'echolink_upload_token'
const ONBOARDING_KEY = 'echolink_onboarding_completed'

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [email, setEmail] = useState('')
  const [isRequestingLink, setIsRequestingLink] = useState(false)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [statsTab, setStatsTab] = useState<StatsTab>('user')
  
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<UploadResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedShare, setCopiedShare] = useState(false)
  const [copiedDirect, setCopiedDirect] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Onboarding state
  const [runOnboarding, setRunOnboarding] = useState(false)
  const [onboardingSteps] = useState<Step[]>([
    {
      target: '.onboarding-upload-zone',
      content: 'Commencez par glisser-déposer votre fichier ici, ou cliquez pour parcourir vos fichiers. Tous les types de fichiers sont acceptés !',
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '.onboarding-stats-button',
      content: 'Consultez vos statistiques d\'utilisation et vos fichiers récents ici. Vous pouvez suivre votre quota de stockage et de fichiers.',
      placement: 'bottom',
    },
    {
      target: '.onboarding-share-info',
      content: 'Une fois votre fichier uploadé, copiez le lien de partage optimisé pour Discord avec prévisualisation intégrée. Parfait pour partager des vidéos et des images !',
      placement: 'top',
      spotlightClicks: false,
    },
  ])

  // Check for existing token on mount
  useEffect(() => {
    checkAuth()
  }, [])

  // Start onboarding for first-time users after authentication
  useEffect(() => {
    if (authState === 'authenticated') {
      const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_KEY)
      if (!hasCompletedOnboarding) {
        // Delay to let the UI render first
        setTimeout(() => setRunOnboarding(true), 500)
      }
    }
  }, [authState])

  const handleOnboardingCallback = (data: CallBackProps) => {
    const { status } = data
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunOnboarding(false)
      localStorage.setItem(ONBOARDING_KEY, 'true')
    }
  }

  const getToken = () => localStorage.getItem(TOKEN_KEY)

  const checkAuth = async () => {
    const token = getToken()
    if (!token) {
      setAuthState('unauthenticated')
      return
    }

    try {
      const [userRes, globalRes] = await Promise.all([
        fetch('/stats/me', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/stats/global', { headers: { 'Authorization': `Bearer ${token}` } })
      ])
      
      if (userRes.ok) {
        setUserStats(await userRes.json())
        setAuthState('authenticated')
      } else {
        localStorage.removeItem(TOKEN_KEY)
        setAuthState('unauthenticated')
        return
      }
      
      if (globalRes.ok) {
        setGlobalStats(await globalRes.json())
      }
    } catch {
      setAuthState('unauthenticated')
    }
  }

  const requestMagicLink = async () => {
    if (!email.trim()) {
      setError('Veuillez entrer votre adresse email.')
      return
    }

    setIsRequestingLink(true)
    setError(null)

    try {
      const res = await fetch('/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'invalid_email') {
          setError('Adresse email invalide.')
        } else {
          setError(data.error || 'Une erreur est survenue.')
        }
        return
      }

      setAuthState('waiting_email')
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setIsRequestingLink(false)
    }
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setAuthState('unauthenticated')
    setUserStats(null)
    setGlobalStats(null)
    setEmail('')
    setFile(null)
    setPreviewUrl(null)
    setResult(null)
  }

  const refreshStats = async () => {
    const token = getToken()
    if (!token) return

    try {
      const [userRes, globalRes] = await Promise.all([
        fetch('/stats/me', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/stats/global', { headers: { 'Authorization': `Bearer ${token}` } })
      ])
      
      if (userRes.ok) {
        setUserStats(await userRes.json())
      }
      if (globalRes.ok) {
        setGlobalStats(await globalRes.json())
      }
    } catch {
      // Ignore errors
    }
  }

  const isImage = (file: File) => file.type.startsWith('image/')
  const isVideo = (file: File) => file.type.startsWith('video/')

  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile)
    setError(null)
    setResult(null)

    // Create preview for images and videos
    if (isImage(selectedFile) || isVideo(selectedFile)) {
      const url = URL.createObjectURL(selectedFile)
      setPreviewUrl(url)
    } else {
      setPreviewUrl(null)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileChange(e.target.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  const clearFile = () => {
    setFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Aucun fichier sélectionné.')
      return
    }

    const token = getToken()
    if (!token) {
      setError('Non authentifié.')
      return
    }

    setIsUploading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'quota_exceeded') {
          setError(data.message || 'Quota dépassé.')
        } else if (data.error === 'unauthorized') {
          logout()
          setError('Session expirée. Veuillez vous reconnecter.')
        } else {
          setError(data.error || `Erreur HTTP ${res.status}`)
        }
        return
      }

      setResult(data)
      refreshStats()
    } catch (e) {
      setError('Erreur réseau ou serveur.')
    } finally {
      setIsUploading(false)
    }
  }

  const copyToClipboard = async (text: string, type: 'share' | 'direct') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'share') {
        setCopiedShare(true)
        setTimeout(() => setCopiedShare(false), 2000)
      } else {
        setCopiedDirect(true)
        setTimeout(() => setCopiedDirect(false), 2000)
      }
    } catch (e) {
      console.error('Failed to copy:', e)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Checking auth state - show loading
  if (authState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-secondary/20">
        <Card className="w-full max-w-md shadow-2xl border-border/50">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Chargement...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Unauthenticated - show email input
  if (authState === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-secondary/20">
        <Card className="w-full max-w-md shadow-2xl border-border/50">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Link2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Echo Link
                </CardTitle>
                <CardDescription className="text-base mt-1">
                  Partagez vos fichiers facilement avec Discord
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Adresse email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && requestMagicLink()}
                disabled={isRequestingLink}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Vous recevrez un lien de connexion par email
              </p>
            </div>

            <Button
              onClick={requestMagicLink}
              disabled={isRequestingLink || !email.trim()}
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              {isRequestingLink ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-5 w-5" />
                  Recevoir le lien de connexion
                </>
              )}
            </Button>

            {error && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Waiting for email verification
  if (authState === 'waiting_email') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-secondary/20">
        <Card className="w-full max-w-md shadow-2xl border-border/50">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">Vérifiez vos emails</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <div className="p-4 rounded-full bg-primary/10 w-20 h-20 mx-auto flex items-center justify-center">
                <Mail className="h-10 w-10 text-primary" />
              </div>
              <p className="text-muted-foreground">
                Un lien de connexion a été envoyé à <strong className="text-foreground">{email}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Cliquez sur le lien dans l'email pour vous connecter. Le lien expire dans 15 minutes.
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setAuthState('unauthenticated')
              }}
              className="w-full"
            >
              Utiliser une autre adresse email
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Authenticated - main upload interface
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-secondary/20">
      <Joyride
        steps={onboardingSteps}
        run={runOnboarding}
        continuous
        showProgress
        showSkipButton
        callback={handleOnboardingCallback}
        styles={{
          options: {
            primaryColor: 'hsl(var(--primary))',
            backgroundColor: 'hsl(var(--background))',
            textColor: 'hsl(var(--foreground))',
            overlayColor: 'rgba(0, 0, 0, 0.6)',
            arrowColor: 'hsl(var(--background))',
            zIndex: 10000,
          },
          tooltip: {
            borderRadius: '0.5rem',
            padding: '1rem',
          },
          buttonNext: {
            backgroundColor: 'hsl(var(--primary))',
            fontSize: '0.875rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
          },
          buttonBack: {
            color: 'hsl(var(--muted-foreground))',
            fontSize: '0.875rem',
            marginRight: 'auto',
          },
          buttonSkip: {
            color: 'hsl(var(--muted-foreground))',
            fontSize: '0.875rem',
          },
        }}
        locale={{
          back: 'Retour',
          close: 'Fermer',
          last: 'Terminer',
          next: 'Suivant',
          skip: 'Passer',
        }}
      />
      <Card className="w-full max-w-2xl shadow-2xl border-border/50">
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
                  {userStats?.user.email}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowStats(!showStats)}
                title="Statistiques"
                className="onboarding-stats-button"
              >
                <BarChart3 className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                title="Déconnexion"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats Panel */}
          {showStats && (
            <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Tabs */}
              <div className="flex gap-2 border-b border-border pb-2">
                <Button
                  variant={statsTab === 'user' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatsTab('user')}
                >
                  Mon espace
                </Button>
                <Button
                  variant={statsTab === 'global' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setStatsTab('global')}
                >
                  Global
                </Button>
              </div>

              {/* User Stats */}
              {statsTab === 'user' && userStats && (
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
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {userStats.recentFiles.slice(0, 5).map(file => (
                          <div key={file.id} className="flex items-center justify-between text-sm py-1">
                            <span className="truncate flex-1 mr-2">{file.title}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => copyToClipboard(file.shareUrl, 'share')}
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
              {statsTab === 'global' && globalStats && (
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
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Aujourd'hui</div>
                      <div>{globalStats.today.files} fichiers</div>
                      <div className="text-muted-foreground">{formatFileSize(globalStats.today.storageBytes)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Cette semaine</div>
                      <div>{globalStats.thisWeek.files} fichiers</div>
                      <div className="text-muted-foreground">{formatFileSize(globalStats.thisWeek.storageBytes)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">Ce mois</div>
                      <div>{globalStats.thisMonth.files} fichiers</div>
                      <div className="text-muted-foreground">{formatFileSize(globalStats.thisMonth.storageBytes)}</div>
                    </div>
                  </div>

                  {globalStats.recentFiles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm text-muted-foreground">Derniers fichiers (plateforme)</h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {globalStats.recentFiles.slice(0, 5).map(file => (
                          <div key={file.id} className="flex items-center justify-between text-sm py-1">
                            <span className="truncate flex-1 mr-2">{file.title}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => copyToClipboard(file.shareUrl, 'share')}
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
          )}

          {/* Drag & Drop Zone */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Fichier à partager</Label>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                onboarding-upload-zone
                relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-all duration-200 ease-in-out
                ${isDragging
                  ? 'border-primary bg-primary/10 scale-[1.02]'
                  : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                }
              `}
            >
              <div className="flex flex-col items-center gap-3">
                <div className={`
                  p-4 rounded-full transition-all duration-200
                  ${isDragging ? 'bg-primary/20' : 'bg-secondary'}
                `}>
                  <Upload className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">
                    {file ? 'Changer de fichier' : 'Glissez-déposez votre fichier ici'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ou cliquez pour parcourir vos fichiers
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleInputChange}
                disabled={isUploading}
                className="hidden"
              />
            </div>
          </div>

          {/* File Preview - Large and Separate */}
          {file && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Aperçu</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  disabled={isUploading}
                  className="h-8 gap-2"
                >
                  <X className="h-4 w-4" />
                  Supprimer
                </Button>
              </div>

              <div className="border-2 border-border rounded-lg overflow-hidden bg-secondary/30">
                {/* Large Preview */}
                {previewUrl && isImage(file) && (
                  <div className="relative w-full aspect-video bg-secondary/50 flex items-center justify-center">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
                {previewUrl && isVideo(file) && (
                  <div className="relative w-full aspect-video bg-secondary/50">
                    <video
                      src={previewUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                {!previewUrl && (
                  <div className="w-full aspect-video bg-secondary/50 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-6 rounded-full bg-secondary">
                        <FileIcon className="h-16 w-16 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">Pas d'aperçu disponible</p>
                    </div>
                  </div>
                )}

                {/* File Info */}
                <div className="p-4 border-t border-border">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                      <FileIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate mb-1">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="font-medium">{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span className="capitalize">{file.type || 'Type inconnu'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={isUploading || !file}
            className="w-full h-12 text-base font-medium"
            size="lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Upload en cours...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-5 w-5" />
                Uploader et générer le lien
              </>
            )}
          </Button>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
              {error}
            </div>
          )}

          {/* Success Result */}
          {result && (
            <div className="onboarding-share-info space-y-4 p-5 rounded-lg bg-primary/5 border-2 border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2 mb-2">
                <Check className="h-5 w-5 text-primary" />
                <p className="font-semibold text-primary">Fichier uploadé avec succès !</p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Lien à partager sur Discord
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={result.shareUrl}
                      readOnly
                      className="font-mono text-sm bg-background/50"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => copyToClipboard(result.shareUrl, 'share')}
                      className="flex-shrink-0"
                    >
                      {copiedShare ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {result.directUrl && (
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                      Lien direct du fichier
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={result.directUrl}
                        readOnly
                        className="font-mono text-sm bg-background/50"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => copyToClipboard(result.directUrl!, 'direct')}
                        className="flex-shrink-0"
                      >
                        {copiedDirect ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
