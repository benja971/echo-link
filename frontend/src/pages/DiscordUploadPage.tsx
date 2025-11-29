import { Check, Copy, Link2, Upload, X, FileIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDiscordUpload } from '@/hooks/useDiscordUpload'

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

interface DiscordUploadPageProps {
  sessionToken: string
  userName: string
}

export function DiscordUploadPage({ sessionToken, userName }: DiscordUploadPageProps) {
  const upload = useDiscordUpload({ sessionToken })

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-secondary/20">
      <Card className="w-full max-w-2xl shadow-2xl border-border/50">
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
                Bienvenue {userName} ! Upload depuis Discord
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Show upload form only if no result yet */}
          {!upload.result && (
            <>
              {/* Drag & Drop Zone */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Fichier à partager</Label>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => upload.fileInputRef.current?.click()}
                  className={`
                    relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                    transition-all duration-200 ease-in-out
                    ${upload.isDragging
                      ? 'border-primary bg-primary/10 scale-[1.02]'
                      : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className={`
                      p-4 rounded-full transition-all duration-200
                      ${upload.isDragging ? 'bg-primary/20' : 'bg-secondary'}
                    `}>
                      <Upload className={`h-8 w-8 ${upload.isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">
                        {upload.file ? 'Changer de fichier' : 'Glissez-déposez votre fichier ici'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ou cliquez pour parcourir vos fichiers
                      </p>
                    </div>
                  </div>
                  <input
                    ref={upload.fileInputRef}
                    type="file"
                    onChange={handleInputChange}
                    disabled={upload.isUploading}
                    className="hidden"
                  />
                </div>
              </div>

              {/* File Preview */}
              {upload.file && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Aperçu</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={upload.clearFile}
                      disabled={upload.isUploading}
                      className="h-8 gap-2"
                    >
                      <X className="h-4 w-4" />
                      Supprimer
                    </Button>
                  </div>

                  <div className="border-2 border-border rounded-lg overflow-hidden bg-secondary/30">
                    {upload.previewUrl && upload.isImage(upload.file) && (
                      <div className="relative w-full aspect-video bg-secondary/50 flex items-center justify-center">
                        <img
                          src={upload.previewUrl}
                          alt="Preview"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    )}
                    {upload.previewUrl && upload.isVideo(upload.file) && (
                      <div className="relative w-full aspect-video bg-secondary/50">
                        <video
                          src={upload.previewUrl}
                          controls
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    {!upload.previewUrl && (
                      <div className="w-full aspect-video bg-secondary/50 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-6 rounded-full bg-secondary">
                            <FileIcon className="h-16 w-16 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground">Pas d'aperçu disponible</p>
                        </div>
                      </div>
                    )}

                    <div className="p-4 border-t border-border">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                          <FileIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate mb-1">
                            {upload.file.name}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="font-medium">{formatFileSize(upload.file.size)}</span>
                            <span>•</span>
                            <span className="capitalize">{upload.file.type || 'Type inconnu'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <Button
                onClick={upload.handleUpload}
                disabled={upload.isUploading || !upload.file}
                className="w-full h-12 text-base font-medium"
                size="lg"
              >
                {upload.isUploading ? (
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
              {upload.error && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
                  {upload.error}
                </div>
              )}
            </>
          )}

          {/* Success Result */}
          {upload.result && (
            <div className="space-y-6 p-6 rounded-lg bg-primary/5 border-2 border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="text-center space-y-4">
                <div className="p-4 rounded-full bg-primary/10 w-20 h-20 mx-auto flex items-center justify-center">
                  <Check className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-primary mb-2">
                    Upload terminé !
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Un message a été envoyé sur Discord avec le lien de partage.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Lien de partage
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={upload.result.shareUrl}
                      readOnly
                      className="font-mono text-sm bg-background/50"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => upload.copyToClipboard(upload.result!.shareUrl)}
                      className="flex-shrink-0"
                    >
                      {upload.copiedShare ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => window.location.href = '/app'}
                  className="w-full"
                >
                  Retourner à l'accueil Echo Link
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Tu peux aussi fermer cette page et retourner sur Discord.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
