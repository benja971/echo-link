import { useState, useEffect } from 'react'

export function useDiscordLinkStatus(getToken: () => string | null, isAuthenticated: boolean) {
  const [hasDiscordLinked, setHasDiscordLinked] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    if (!isAuthenticated) return

    const token = getToken()
    if (!token) return

    fetch('/me/discord/link/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setHasDiscordLinked(data.hasDiscordLinked) })
      .catch(() => {})
  }, [isAuthenticated])

  return {
    hasDiscordLinked,
    setHasDiscordLinked,
  }
}
