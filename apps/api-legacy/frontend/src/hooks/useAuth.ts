import { useState, useEffect } from 'react'
import type { AuthState, UserStats, GlobalStats } from '@/types'
import { TOKEN_KEY } from '@/types'

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [email, setEmail] = useState('')
  const [isRequestingLink, setIsRequestingLink] = useState(false)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  // Discord session state
  const [discordSessionToken, setDiscordSessionToken] = useState<string | null>(null)
  const [discordUserName, setDiscordUserName] = useState<string | null>(null)

  const getToken = () => localStorage.getItem(TOKEN_KEY)

  const checkDiscordSession = async (token: string) => {
    try {
      const res = await fetch(`/discord/session/${token}`)
      const data = await res.json()
      
      if (res.ok && data.valid) {
        setDiscordSessionToken(token)
        setDiscordUserName(data.userName)
        setAuthState('discord_session')
      } else {
        setError(data.message || 'Session Discord invalide ou expirée')
        setAuthState('unauthenticated')
      }
    } catch {
      setError('Erreur lors de la vérification de la session')
      setAuthState('unauthenticated')
    }
  }

  const checkAuth = async () => {
    const token = getToken()
    if (!token) {
      setAuthState('unauthenticated')
      return
    }

    try {
      const [userRes, globalRes] = await Promise.all([
        fetch('/stats/me', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/stats/global', { headers: { 'Authorization': `Bearer ${token}` } })
      ])

      if (userRes.ok) {
        setUserStats(await userRes.json())
        setAuthState('authenticated')
      } else {
        localStorage.removeItem(TOKEN_KEY)
        setAuthState('unauthenticated')
        return
      }

      if (globalRes.ok) {
        setGlobalStats(await globalRes.json())
      }
    } catch {
      setAuthState('unauthenticated')
    }
  }

  const requestMagicLink = async () => {
    if (!email.trim()) {
      setError('Veuillez entrer votre adresse email.')
      return
    }

    setIsRequestingLink(true)
    setError(null)

    try {
      const res = await fetch('/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'invalid_email') {
          setError('Adresse email invalide.')
        } else {
          setError(data.error || 'Une erreur est survenue.')
        }
        return
      }

      setAuthState('waiting_email')
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setIsRequestingLink(false)
    }
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setAuthState('unauthenticated')
    setUserStats(null)
    setGlobalStats(null)
    setEmail('')
  }

  const refreshStats = async () => {
    const token = getToken()
    if (!token) return

    try {
      const [userRes, globalRes] = await Promise.all([
        fetch('/stats/me', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/stats/global', { headers: { 'Authorization': `Bearer ${token}` } })
      ])

      if (userRes.ok) {
        setUserStats(await userRes.json())
      }
      if (globalRes.ok) {
        setGlobalStats(await globalRes.json())
      }
    } catch {
      // Ignore errors
    }
  }

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const discordSession = urlParams.get('discord_session')
    
    if (discordSession) {
      checkDiscordSession(discordSession)
    } else {
      checkAuth()
    }
  }, [])

  return {
    authState,
    email,
    setEmail,
    isRequestingLink,
    userStats,
    globalStats,
    error,
    setError,
    setAuthState,
    getToken,
    requestMagicLink,
    logout,
    refreshStats,
    // Discord session
    discordSessionToken,
    discordUserName,
  }
}
