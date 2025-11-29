import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UploadResponse } from '@/types'

interface UploadResultsProps {
  result: UploadResponse
  copiedShare: boolean
  copiedDirect: boolean
  onCopy: (text: string, type: 'share' | 'direct') => void
}

export function UploadResults({ result, copiedShare, copiedDirect, onCopy }: UploadResultsProps) {
  return (
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
              onClick={() => onCopy(result.shareUrl, 'share')}
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
                onClick={() => onCopy(result.directUrl!, 'direct')}
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
  )
}
