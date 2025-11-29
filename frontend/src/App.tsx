import { useState } from 'react'
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
import { GalleryPanel } from '@/components/GalleryPanel'
import { StatsDialog } from '@/components/StatsDialog'
import { FilePreviewModal } from '@/components/FilePreviewModal'
import { StatsTab, FileItem } from '@/types'

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
  const [statsTab, setStatsTab] = useState<StatsTab>('user')
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null)

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

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    upload.setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    upload.setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    upload.setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      upload.handleFileChange(e.dataTransfer.files[0])
    }
  }

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
          onToggleGallery={() => {
            setShowGallery(!showGallery)
            setShowStats(false)
          }}
          onToggleStats={() => {
            setShowStats(!showStats)
            setShowGallery(false)
          }}
          onLogout={auth.logout}
        />

        <CardContent className="space-y-4">
          <UploadZone
            file={upload.file}
            isDragging={upload.isDragging}
            isUploading={upload.isUploading}
            fileInputRef={upload.fileInputRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
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

      {/* File preview modal */}
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        formatFileSize={formatFileSize}
      />
    </div>
  )
}
