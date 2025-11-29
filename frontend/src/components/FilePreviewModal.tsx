import { X, Copy, Check, Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FileItem } from '@/types'
import { useState } from 'react'

interface FilePreviewModalProps {
  file: FileItem | null
  onClose: () => void
  formatFileSize: (bytes: number) => string
}

export function FilePreviewModal({ file, onClose, formatFileSize }: FilePreviewModalProps) {
  const [copied, setCopied] = useState(false)

  if (!file) return null

  const isImage = file.mimeType.startsWith('image/')
  const isVideo = file.mimeType.startsWith('video/')

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(file.shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      console.error('Failed to copy:', e)
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-lg font-semibold truncate">{file.title}</h2>
            <p className="text-sm text-muted-foreground">
              {formatFileSize(file.sizeBytes)} • {file.mimeType}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyLink}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  Copié
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copier le lien
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-2"
            >
              <a href={file.directUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Ouvrir
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-2"
            >
              <a href={file.directUrl} download={file.title}>
                <Download className="h-4 w-4" />
                Télécharger
              </a>
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-secondary/30">
          {isImage && (
            <img
              src={file.directUrl}
              alt={file.title}
              className="max-w-full max-h-[70vh] object-contain rounded"
            />
          )}
          {isVideo && (
            <video
              src={file.directUrl}
              controls
              className="max-w-full max-h-[70vh] rounded"
            />
          )}
          {!isImage && !isVideo && (
            <div className="text-center text-muted-foreground">
              <p className="text-lg mb-2">Aperçu non disponible</p>
              <p className="text-sm">Utilisez le bouton "Ouvrir" ou "Télécharger"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
