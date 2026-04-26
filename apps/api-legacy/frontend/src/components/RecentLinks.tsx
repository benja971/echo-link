import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { FileItem } from '@/types'

interface RecentLinksProps {
  recentFiles: FileItem[]
  onCopy: (url: string) => void
}

export function RecentLinks({ recentFiles, onCopy }: RecentLinksProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = (file: FileItem) => {
    onCopy(file.shareUrl)
    setCopiedId(file.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Derniers fichiers</p>
      <div className="space-y-1">
        {recentFiles.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/50 text-sm"
          >
            <span className="truncate flex-1 text-foreground/80">{file.title}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 flex-shrink-0"
              onClick={() => handleCopy(file)}
            >
              {copiedId === file.id ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
