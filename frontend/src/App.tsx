import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useGallery } from '@/hooks/useGallery'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useClipboardPaste } from '@/hooks/useClipboardPaste'
import { useDropAnywhere } from '@/hooks/useDropAnywhere'
import { useDiscordLinkStatus } from '@/hooks/useDiscordLinkStatus'
import { LoginPage } from '@/pages/LoginPage'
import { DiscordUploadPage } from '@/pages/DiscordUploadPage'
import { Header } from '@/components/Header'
import { UploadZone } from '@/components/UploadZone'
import { FilePreview } from '@/components/FilePreview'
import { UploadResults } from '@/components/UploadResults'
import { RecentLinks } from '@/components/RecentLinks'
import { GalleryPanel } from '@/components/GalleryPanel'
import { StatsDialog } from '@/components/StatsDialog'
import { AccountDialog } from '@/components/AccountDialog'
import { FilePreviewModal } from '@/components/FilePreviewModal'
import { formatFileSize } from '@/lib/utils'
import type { StatsTab, FileItem } from '@/types'

type Panel = 'gallery' | 'stats' | 'account' | null

export default function App() {
  const [activePanel, setActivePanel] = useState<Panel>(null)
  const [statsTab, setStatsTab] = useState<StatsTab>('user')
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)

  const auth = useAuth()
  const { hasDiscordLinked, setHasDiscordLinked } = useDiscordLinkStatus(
    auth.getToken,
    auth.authState === 'authenticated'
  )

  const upload = useFileUpload({
    getToken: auth.getToken,
    onSuccess: () => {
      auth.refreshStats()
      if (activePanel === 'gallery') {
        gallery.loadAllFiles()
      }
    }
  })

  const gallery = useGallery({
    getToken: auth.getToken,
    showGallery: activePanel === 'gallery',
    onRefreshStats: auth.refreshStats
  })

  const isDragging = useDropAnywhere({
    onFile: upload.handleFileChange,
    enabled: !upload.isUploading,
  })

  useClipboardPaste({
    onFile: upload.handleFileChange,
    enabled: !upload.isUploading,
  })

  useKeyboardShortcuts([
    { key: 'o', ctrl: true, action: () => upload.fileInputRef.current?.click() },
    { key: 'Escape', action: () => upload.clearFile(), enabled: !!upload.file },
  ])

  const togglePanel = (panel: Panel) =>
    setActivePanel(prev => prev === panel ? null : panel)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      upload.handleFileChange(e.target.files[0])
    }
  }

  // Discord session mode
  if (auth.authState === 'discord_session' && auth.discordSessionToken) {
    return (
      <DiscordUploadPage
        sessionToken={auth.discordSessionToken}
        userName={auth.discordUserName || 'Utilisateur Discord'}
      />
    )
  }

  // Not authenticated - show login
  if (auth.authState !== 'authenticated') {
    return (
      <LoginPage
        authState={auth.authState}
        email={auth.email}
        setEmail={auth.setEmail}
        isRequestingLink={auth.isRequestingLink}
        error={auth.error}
        requestMagicLink={auth.requestMagicLink}
        setAuthState={auth.setAuthState}
      />
    )
  }

  // Authenticated - main interface
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-secondary/20">
      <Card className="w-full max-w-2xl shadow-2xl border-border/50">
        <Header
          email={auth.userStats?.user.email || ''}
          showGallery={activePanel === 'gallery'}
          showStats={activePanel === 'stats'}
          hasDiscordLinked={hasDiscordLinked}
          onToggleGallery={() => togglePanel('gallery')}
          onToggleStats={() => togglePanel('stats')}
          onOpenAccountLink={() => setActivePanel('account')}
          onLogout={auth.logout}
        />

        <CardContent className="space-y-4">
          <UploadZone
            file={upload.file}
            isUploading={upload.isUploading}
            fileInputRef={upload.fileInputRef}
            onClick={() => upload.fileInputRef.current?.click()}
            onInputChange={handleInputChange}
            onUpload={() => upload.handleUpload(auth.logout)}
          />

          {upload.file && (
            <FilePreview
              file={upload.file}
              previewUrl={upload.previewUrl}
              isUploading={upload.isUploading}
              onClear={upload.clearFile}
              formatFileSize={formatFileSize}
            />
          )}

          {upload.error && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
              {upload.error}
            </div>
          )}

          {upload.result && (
            <UploadResults
              result={upload.result}
              copiedShare={upload.copiedShare}
              copiedDirect={upload.copiedDirect}
              onCopy={upload.copyToClipboard}
            />
          )}

          {activePanel !== 'gallery' && auth.userStats && auth.userStats.recentFiles.length > 0 && (
            <RecentLinks
              recentFiles={auth.userStats.recentFiles.slice(0, 3)}
              onCopy={(url) => upload.copyToClipboard(url, 'share')}
            />
          )}
        </CardContent>
      </Card>

      {/* Gallery panel as a side drawer */}
      {activePanel === 'gallery' && (
        <Card className="fixed right-4 top-4 bottom-4 w-80 shadow-2xl border-border/50 overflow-hidden">
          <CardContent className="h-full p-4">
            <GalleryPanel
              allFiles={gallery.allFiles}
              isLoadingFiles={gallery.isLoadingFiles}
              isDeletingFile={gallery.isDeletingFile}
              onRefresh={gallery.loadAllFiles}
              onCopyLink={(url) => upload.copyToClipboard(url, 'share')}
              onDelete={gallery.deleteFile}
              onPreview={setPreviewFile}
              formatFileSize={formatFileSize}
            />
          </CardContent>
        </Card>
      )}

      {/* Stats dialog */}
      <StatsDialog
        isOpen={activePanel === 'stats'}
        onClose={() => setActivePanel(null)}
        userStats={auth.userStats}
        globalStats={auth.globalStats}
        activeTab={statsTab}
        onTabChange={setStatsTab}
        onCopyLink={(url) => upload.copyToClipboard(url, 'share')}
        formatFileSize={formatFileSize}
      />

      {/* Account dialog */}
      <AccountDialog
        isOpen={activePanel === 'account'}
        onClose={() => setActivePanel(null)}
        userStats={auth.userStats}
        getToken={auth.getToken}
        onDiscordLinked={() => setHasDiscordLinked(true)}
        onDiscordUnlinked={() => setHasDiscordLinked(false)}
      />

      {/* File preview modal */}
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        formatFileSize={formatFileSize}
      />

      {/* Full-screen drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-4 border-dashed border-primary/50 pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-primary">
            <Upload className="h-16 w-16" />
            <p className="text-xl font-semibold">Déposez votre fichier</p>
          </div>
        </div>
      )}
    </div>
  )
}
