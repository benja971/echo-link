import { useState, useEffect } from 'react'
import { Upload } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useGallery } from '@/hooks/useGallery'
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
import type { StatsTab, FileItem } from '@/types'

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

export default function App() {
  const [showGallery, setShowGallery] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [statsTab, setStatsTab] = useState<StatsTab>('user')
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)
  const [hasDiscordLinked, setHasDiscordLinked] = useState<boolean | undefined>(undefined)

  const auth = useAuth()
  
  const upload = useFileUpload({
    getToken: auth.getToken,
    onSuccess: () => {
      auth.refreshStats()
      if (showGallery) {
        gallery.loadAllFiles()
      }
    }
  })

  const gallery = useGallery({
    getToken: auth.getToken,
    showGallery,
    onRefreshStats: auth.refreshStats
  })

  // Check Discord link status on mount
  useEffect(() => {
    if (auth.authState === 'authenticated') {
      checkDiscordLinkStatus()
    }
  }, [auth.authState])

  const checkDiscordLinkStatus = async () => {
    const token = auth.getToken()
    if (!token) return

    try {
      const res = await fetch('/me/discord/link/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setHasDiscordLinked(data.hasDiscordLinked)
      }
    } catch {
      // Ignore
    }
  }

  const openAccountLink = () => {
    setShowAccount(true)
    setShowStats(false)
    setShowGallery(false)
  }

  // Handle paste (Ctrl+V with image/video in clipboard)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (upload.isUploading) return
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.kind === 'file') {
          const pastedFile = item.getAsFile()
          if (pastedFile) {
            e.preventDefault()
            upload.handleFileChange(pastedFile)
            return
          }
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [upload.isUploading])

  // Handle drag events globally (drop-anywhere)
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      upload.setIsDragging(true)
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      // Only leave when exiting the window (relatedTarget is null)
      if (!e.relatedTarget && e.clientX === 0 && e.clientY === 0) {
        upload.setIsDragging(false)
      }
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      upload.setIsDragging(false)
      if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
        upload.handleFileChange(e.dataTransfer.files[0])
      }
    }

    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('drop', handleDrop)
    }
  }, [upload.isUploading])

  // Ctrl+O to open file picker
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        upload.fileInputRef.current?.click()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

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
          showGallery={showGallery}
          showStats={showStats}
          hasDiscordLinked={hasDiscordLinked}
          onToggleGallery={() => {
            setShowGallery(!showGallery)
            setShowStats(false)
          }}
          onToggleStats={() => {
            setShowStats(!showStats)
            setShowGallery(false)
          }}
          onOpenAccountLink={openAccountLink}
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

          {!showGallery && auth.userStats && auth.userStats.recentFiles.length > 0 && (
            <RecentLinks
              recentFiles={auth.userStats.recentFiles.slice(0, 3)}
              onCopy={(url) => upload.copyToClipboard(url, 'share')}
            />
          )}
        </CardContent>
      </Card>

      {/* Gallery panel as a side drawer */}
      {showGallery && (
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
        isOpen={showStats}
        onClose={() => setShowStats(false)}
        userStats={auth.userStats}
        globalStats={auth.globalStats}
        activeTab={statsTab}
        onTabChange={setStatsTab}
        onCopyLink={(url) => upload.copyToClipboard(url, 'share')}
        formatFileSize={formatFileSize}
      />

      {/* Account dialog */}
      <AccountDialog
        isOpen={showAccount}
        onClose={() => setShowAccount(false)}
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
      {upload.isDragging && (
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
