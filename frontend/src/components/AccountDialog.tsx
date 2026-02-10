import { useState, useEffect } from 'react'
import { Copy, X, Check, Loader2, RefreshCw, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DiscordLinkStatus, DiscordLinkRequest, UserStats } from '@/types'

interface AccountDialogProps {
  isOpen: boolean
  onClose: () => void
  userStats: UserStats | null
  getToken: () => string | null
  onDiscordLinked?: () => void
  onDiscordUnlinked?: () => void
}

export function AccountDialog({
  isOpen,
  onClose,
  userStats,
  getToken,
  onDiscordLinked,
  onDiscordUnlinked
}: AccountDialogProps) {
  const [discordStatus, setDiscordStatus] = useState<DiscordLinkStatus | null>(null)
  const [linkCode, setLinkCode] = useState<DiscordLinkRequest | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState<string | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justLinked, setJustLinked] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchDiscordStatus()
    }
  }, [isOpen])

  // Poll for link completion when a code is active
  useEffect(() => {
    if (!isOpen || !linkCode || justLinked) return
    
    const interval = setInterval(async () => {
      const token = getToken()
      if (!token) return

      try {
        const res = await fetch('/me/discord/link/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (res.ok) {
          const data = await res.json()
          if (data.hasDiscordLinked && data.discordIdentities?.length > 0) {
            setDiscordStatus(data)
            setLinkCode(null)
            setJustLinked(true)
            onDiscordLinked?.()
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isOpen, linkCode, justLinked, getToken, onDiscordLinked])

  useEffect(() => {
    if (!isOpen) {
      setJustLinked(false)
    }
  }, [isOpen])

  const fetchDiscordStatus = async () => {
    const token = getToken()
    if (!token) return

    setIsLoadingStatus(true)
    setError(null)

    try {
      const res = await fetch('/me/discord/link/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.ok) {
        const data = await res.json()
        setDiscordStatus(data)
        
        if (data.pendingRequests?.length > 0) {
          const pending = data.pendingRequests[0]
          setLinkCode({
            code: pending.code,
            expiresAt: pending.expiresAt,
            instructions: `Sur Discord, exécute: /link code:${pending.code}`
          })
        } else {
          setLinkCode(null)
        }
      }
    } catch {
      setError('Erreur lors du chargement')
    } finally {
      setIsLoadingStatus(false)
    }
  }

  const generateLinkCode = async () => {
    const token = getToken()
    if (!token) return

    setIsGenerating(true)
    setError(null)

    try {
      const res = await fetch('/me/discord/link/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.ok) {
        const data: DiscordLinkRequest = await res.json()
        setLinkCode(data)
        await fetchDiscordStatus()
      } else {
        const data = await res.json()
        setError(data.message || 'Erreur lors de la génération')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setIsGenerating(false)
    }
  }

  const unlinkDiscord = async (identityId: string) => {
    const token = getToken()
    if (!token) return

    setIsUnlinking(identityId)
    setError(null)

    try {
      const res = await fetch(`/me/discord/unlink/${identityId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.ok) {
        await fetchDiscordStatus()
        onDiscordUnlinked?.()
      } else {
        const data = await res.json()
        setError(data.message || 'Erreur lors de la suppression')
      }
    } catch {
      setError('Erreur réseau')
    } finally {
      setIsUnlinking(null)
    }
  }

  const copyCode = () => {
    if (linkCode) {
      navigator.clipboard.writeText(linkCode.code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    }
  }

  const isCodeExpired = linkCode ? new Date(linkCode.expiresAt) < new Date() : false
  const codeExpiresIn = linkCode ? Math.max(0, Math.floor((new Date(linkCode.expiresAt).getTime() - Date.now()) / 60000)) : 0

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold">Mon compte</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Linked identities */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Comptes liés</h4>
            
            {/* Web identity */}
            {userStats?.user.email && (
              <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                <div className="p-2 bg-primary/10 rounded-full">
                  <svg className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{userStats.user.email}</div>
                  <div className="text-xs text-muted-foreground">Email (principal)</div>
                </div>
                <Check className="h-4 w-4 text-green-500" />
              </div>
            )}

            {/* Discord identities */}
            {isLoadingStatus ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : discordStatus?.discordIdentities && discordStatus.discordIdentities.length > 0 ? (
              discordStatus.discordIdentities.map(identity => (
                <div key={identity.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg group">
                  <div className="p-2 bg-[#5865F2]/20 rounded-full">
                    <svg className="h-4 w-4 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{identity.displayName || 'Utilisateur Discord'}</div>
                    <div className="text-xs text-muted-foreground">Discord</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    onClick={() => unlinkDiscord(identity.id)}
                    disabled={isUnlinking === identity.id}
                    title="Délier ce compte"
                  >
                    {isUnlinking === identity.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))
            ) : !justLinked ? (
              <div className="p-3 border border-dashed border-border rounded-lg text-center text-sm text-muted-foreground">
                Aucun compte Discord lié
              </div>
            ) : null}
          </div>

          {/* Success message after linking */}
          {justLinked && (
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm text-center animate-in fade-in slide-in-from-bottom-2">
              <Check className="h-5 w-5 mx-auto mb-2" />
              Compte Discord lié avec succès !
            </div>
          )}

          {/* Link Discord section */}
          {(!discordStatus?.hasDiscordLinked || discordStatus.discordIdentities.length === 0) && !justLinked && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Lier un compte Discord</h4>
              <p className="text-xs text-muted-foreground">
                Associe ton compte Discord pour retrouver tous tes fichiers au même endroit.
              </p>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}

              {linkCode && !isCodeExpired ? (
                <div className="space-y-3">
                  <div className="p-4 bg-secondary/50 rounded-lg text-center">
                    <div className="text-xs text-muted-foreground mb-2">Ton code de liaison</div>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-2xl font-mono font-bold tracking-widest">{linkCode.code}</code>
                      <Button variant="ghost" size="icon" onClick={copyCode} className="h-8 w-8">
                        {codeCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Expire dans {codeExpiresIn} minute{codeExpiresIn > 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-sm text-center text-muted-foreground">
                    Sur Discord, exécute la commande : <code className="bg-secondary px-2 py-1 rounded">/link code:{linkCode.code}</code>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={generateLinkCode}
                    disabled={isGenerating}
                  >
                    {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Générer un nouveau code
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={generateLinkCode} 
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  )}
                  Générer un code de liaison Discord
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
