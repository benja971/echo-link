import { useState, useRef } from 'react'
import { UploadResponse } from '@/types'

interface UseDiscordUploadProps {
  sessionToken: string
  onSuccess?: () => void
}

export function useDiscordUpload({ sessionToken, onSuccess }: UseDiscordUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<UploadResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedShare, setCopiedShare] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isImage = (file: File) => file.type.startsWith('image/')
  const isVideo = (file: File) => file.type.startsWith('video/')

  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile)
    setError(null)
    setResult(null)

    if (isImage(selectedFile) || isVideo(selectedFile)) {
      const url = URL.createObjectURL(selectedFile)
      setPreviewUrl(url)
    } else {
      setPreviewUrl(null)
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

    setIsUploading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`/discord/upload/${sessionToken}`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'quota_exceeded') {
          setError(data.message || 'Quota dépassé.')
        } else if (data.error === 'session_invalid') {
          setError('Session expirée. Retourne sur Discord pour en créer une nouvelle.')
        } else {
          setError(data.message || data.error || `Erreur HTTP ${res.status}`)
        }
        return
      }

      setResult(data)
      clearFile()
      if (onSuccess) onSuccess()
    } catch (e) {
      setError('Erreur réseau ou serveur.')
    } finally {
      setIsUploading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2000)
    } catch (e) {
      console.error('Failed to copy:', e)
    }
  }

  return {
    file,
    previewUrl,
    isUploading,
    result,
    error,
    copiedShare,
    isDragging,
    fileInputRef,
    setIsDragging,
    isImage,
    isVideo,
    handleFileChange,
    clearFile,
    handleUpload,
    copyToClipboard,
  }
}
