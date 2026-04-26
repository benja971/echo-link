import { Copy, Trash2, Loader2, FileIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FileItem } from '@/types'

interface GalleryPanelProps {
  allFiles: FileItem[]
  isLoadingFiles: boolean
  isDeletingFile: string | null
  onRefresh: () => void
  onCopyLink: (url: string) => void
  onDelete: (fileId: string) => void
  onPreview: (file: FileItem) => void
  formatFileSize: (bytes: number) => string
}

export function GalleryPanel({
  allFiles,
  isLoadingFiles,
  isDeletingFile,
  onRefresh,
  onCopyLink,
  onDelete,
  onPreview,
  formatFileSize
}: GalleryPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Ma galerie</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoadingFiles}
        >
          {isLoadingFiles ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Actualiser'
          )}
        </Button>
      </div>

      {isLoadingFiles ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : allFiles.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Aucun fichier pour le moment</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto flex-1">
          {allFiles.map(file => {
            const isImageFile = file.mimeType.startsWith('image/')
            const isVideoFile = file.mimeType.startsWith('video/')

            return (
              <div 
                key={file.id} 
                className="group relative border border-border rounded-lg overflow-hidden bg-secondary/50 hover:bg-secondary/70 transition-colors flex items-center gap-3 p-2 cursor-pointer"
                onClick={() => onPreview(file)}
              >
                {/* Thumbnail */}
                <div className="w-12 h-12 flex-shrink-0 rounded bg-secondary/30 flex items-center justify-center overflow-hidden">
                  {isImageFile ? (
                    <img
                      src={file.directUrl}
                      alt={file.title}
                      className="w-full h-full object-cover"
                    />
                  ) : isVideoFile ? (
                    <video
                      src={file.directUrl}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={file.title}>
                    {file.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.sizeBytes)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation()
                      onCopyLink(file.shareUrl)
                    }}
                    title="Copier le lien"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(file.id)
                    }}
                    disabled={isDeletingFile === file.id}
                    title="Supprimer"
                  >
                    {isDeletingFile === file.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
