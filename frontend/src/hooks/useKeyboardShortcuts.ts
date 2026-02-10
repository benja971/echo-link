import { useEffect, useRef } from 'react'

interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  action: () => void
  enabled?: boolean
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      for (const shortcut of shortcutsRef.current) {
        if (shortcut.enabled === false) continue
        if (shortcut.ctrl && !(e.ctrlKey || e.metaKey)) continue
        if (!shortcut.ctrl && (e.ctrlKey || e.metaKey)) continue
        if (e.key.toLowerCase() !== shortcut.key.toLowerCase()) continue

        e.preventDefault()
        shortcut.action()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
