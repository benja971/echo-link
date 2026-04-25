import { X, FileIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface FilePreviewProps {
  file: File
  previewUrl: string | null
  isUploading: boolean
  onClear: () => void
  formatFileSize: (bytes: number) => string
}

export function FilePreview({ file, previewUrl, isUploading, onClear, formatFileSize }: FilePreviewProps) {
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Aperçu</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={isUploading}
          className="h-8 gap-2"
        >
          <X className="h-4 w-4" />
          Supprimer
        </Button>
      </div>

      <div className="border-2 border-border rounded-lg overflow-hidden bg-secondary/30">
        {/* Large Preview */}
        {previewUrl && isImage && (
          <div className="relative w-full aspect-video bg-secondary/50 flex items-center justify-center">
            <img
              src={previewUrl}
              alt="Preview"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}
        {previewUrl && isVideo && (
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
  )
}
