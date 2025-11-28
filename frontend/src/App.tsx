import { useState, useRef } from 'react'
import { Upload, Link2, FileIcon, Copy, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface UploadResponse {
  shareUrl: string
  directUrl?: string
}

export default function App() {
  const [token, setToken] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<UploadResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedShare, setCopiedShare] = useState(false)
  const [copiedDirect, setCopiedDirect] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    if (!token.trim()) {
      setError('Token manquant.')
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
          'Authorization': `Bearer ${token.trim()}`
        },
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || `Erreur HTTP ${res.status}`)
        return
      }

      setResult(data)
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
                Partagez vos fichiers facilement avec Discord
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Token Input */}
          <div className="space-y-2">
            <Label htmlFor="token" className="text-sm font-medium">
              Token d'upload
            </Label>
            <Input
              id="token"
              type="password"
              placeholder="Entrez votre UPLOAD_TOKEN"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={isUploading}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Utilisé pour l'authentification Bearer sur l'API /upload
            </p>
          </div>

          {/* Drag & Drop Zone */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Fichier à partager</Label>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
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
            disabled={isUploading || !file || !token}
            className="w-full h-12 text-base font-medium"
            size="lg"
          >
            {isUploading ? (
              <>
                <Upload className="mr-2 h-5 w-5 animate-spin" />
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
            <div className="space-y-4 p-5 rounded-lg bg-primary/5 border-2 border-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
