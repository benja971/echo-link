import { useState, useRef } from 'react'
import { UploadResponse } from '@/types'

interface UseFileUploadProps {
  getToken: () => string | null
  onSuccess?: () => void
  onError?: () => void
}

export function useFileUpload({ getToken, onSuccess, onError }: UseFileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<UploadResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedShare, setCopiedShare] = useState(false)
  const [copiedDirect, setCopiedDirect] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isImage = (file: File) => file.type.startsWith('image/')
  const isVideo = (file: File) => file.type.startsWith('video/')

  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile)
    setError(null)
    setResult(null)

    // Create preview for images and videos
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

  const handleUpload = async (logout: () => void) => {
    if (!file) {
      setError('Aucun fichier sélectionné.')
      return
    }

    const token = getToken()
    if (!token) {
      setError('Non authentifié.')
      return
    }

    setIsUploading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'quota_exceeded') {
          setError(data.message || 'Quota dépassé.')
        } else if (data.error === 'unauthorized') {
          logout()
          setError('Session expirée. Veuillez vous reconnecter.')
        } else {
          setError(data.error || `Erreur HTTP ${res.status}`)
        }
        if (onError) onError()
        return
      }

      setResult(data)
      clearFile()
      if (onSuccess) onSuccess()
    } catch (e) {
      setError('Erreur réseau ou serveur.')
      if (onError) onError()
    } finally {
      setIsUploading(false)
    }
  }

  const copyToClipboard = async (text: string, type: 'share' | 'direct') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'share') {
        setCopiedShare(true)
        setTimeout(() => setCopiedShare(false), 2000)
      } else {
        setCopiedDirect(true)
        setTimeout(() => setCopiedDirect(false), 2000)
      }
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
    copiedDirect,
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
