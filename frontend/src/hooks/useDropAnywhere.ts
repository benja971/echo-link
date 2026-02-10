import { useState, useEffect, useRef } from 'react'

interface UseDropAnywhereProps {
  onFile: (file: File) => void
  enabled?: boolean
}

export function useDropAnywhere({ onFile, enabled = true }: UseDropAnywhereProps) {
  const [isDragging, setIsDragging] = useState(false)

  const onFileRef = useRef(onFile)
  onFileRef.current = onFile

  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (enabledRef.current) setIsDragging(true)
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      if (!e.relatedTarget && e.clientX === 0 && e.clientY === 0) {
        setIsDragging(false)
      }
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (!enabledRef.current) return
      if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
        onFileRef.current(e.dataTransfer.files[0])
      }
    }

    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('drop', handleDrop)
    }
  }, [])

  return isDragging
}
