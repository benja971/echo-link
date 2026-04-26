import { useEffect, useRef } from 'react'

interface UseClipboardPasteProps {
  onFile: (file: File) => void
  enabled?: boolean
}

export function useClipboardPaste({ onFile, enabled = true }: UseClipboardPasteProps) {
  const onFileRef = useRef(onFile)
  onFileRef.current = onFile

  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!enabledRef.current) return
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.kind === 'file') {
          const pastedFile = item.getAsFile()
          if (pastedFile) {
            e.preventDefault()
            onFileRef.current(pastedFile)
            return
          }
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])
}
