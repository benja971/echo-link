import { Mail, Loader2, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AuthState } from '@/types'

interface LoginPageProps {
  authState: AuthState
  email: string
  setEmail: (email: string) => void
  isRequestingLink: boolean
  error: string | null
  requestMagicLink: () => void
  setAuthState: (state: AuthState) => void
}

export function LoginPage({
  authState,
  email,
  setEmail,
  isRequestingLink,
  error,
  requestMagicLink,
  setAuthState
}: LoginPageProps) {
  if (authState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-secondary/20">
        <Card className="w-full max-w-md shadow-2xl border-border/50">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Chargement...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (authState === 'waiting_email') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-secondary/20">
        <Card className="w-full max-w-md shadow-2xl border-border/50">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">Vérifiez vos emails</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <div className="p-4 rounded-full bg-primary/10 w-20 h-20 mx-auto flex items-center justify-center">
                <Mail className="h-10 w-10 text-primary" />
              </div>
              <p className="text-muted-foreground">
                Un lien de connexion a été envoyé à <strong className="text-foreground">{email}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Cliquez sur le lien dans l'email pour vous connecter. Le lien expire dans 15 minutes.
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => setAuthState('unauthenticated')}
              className="w-full"
            >
              Utiliser une autre adresse email
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-secondary/20">
      <Card className="w-full max-w-md shadow-2xl border-border/50">
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
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Adresse email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && requestMagicLink()}
              disabled={isRequestingLink}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Vous recevrez un lien de connexion par email
            </p>
          </div>

          <Button
            onClick={requestMagicLink}
            disabled={isRequestingLink || !email.trim()}
            className="w-full h-12 text-base font-medium"
            size="lg"
          >
            {isRequestingLink ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-5 w-5" />
                Recevoir le lien de connexion
              </>
            )}
          </Button>

          {error && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
