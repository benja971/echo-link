import { Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { RefObject } from 'react'

interface UploadZoneProps {
  file: File | null
  isUploading: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onClick: () => void
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onUpload: () => void
}

export function UploadZone({
  file,
  isUploading,
  fileInputRef,
  onClick,
  onInputChange,
  onUpload
}: UploadZoneProps) {
  return (
    <div className="space-y-4">
      {/* Drag & Drop Zone */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Fichier à partager</Label>

        <div
          onClick={onClick}
          className="onboarding-upload-zone relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ease-in-out border-border hover:border-primary/50 hover:bg-secondary/50"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-full transition-all duration-200 bg-secondary">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium mb-1">
                {file ? 'Changer de fichier' : 'Glissez-déposez votre fichier ici'}
              </p>
              <p className="text-xs text-muted-foreground">
                ou cliquez pour parcourir vos fichiers (Ctrl+V pour coller)
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={onInputChange}
            disabled={isUploading}
            className="hidden"
          />
        </div>
      </div>

      {/* Upload Button */}
      <Button
        onClick={onUpload}
        disabled={isUploading || !file}
        className="onboarding-upload-button w-full h-12 text-base font-medium"
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
    </div>
  )
}
