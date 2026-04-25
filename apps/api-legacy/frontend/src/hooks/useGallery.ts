import { useState, useEffect } from 'react'
import type { FileItem } from '@/types'

interface UseGalleryProps {
  getToken: () => string | null
  showGallery: boolean
  onRefreshStats?: () => void
}

export function useGallery({ getToken, showGallery, onRefreshStats }: UseGalleryProps) {
  const [allFiles, setAllFiles] = useState<FileItem[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [isDeletingFile, setIsDeletingFile] = useState<string | null>(null)

  const loadAllFiles = async () => {
    const token = getToken()
    if (!token) return

    setIsLoadingFiles(true)
    try {
      const res = await fetch('/stats/files', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.ok) {
        const data = await res.json()
        setAllFiles(data.files)
      }
    } catch (error) {
      console.error('Failed to load files:', error)
    } finally {
      setIsLoadingFiles(false)
    }
  }

  const deleteFile = async (fileId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce fichier ? Cette action est irréversible.')) {
      return
    }

    const token = getToken()
    if (!token) return

    setIsDeletingFile(fileId)
    try {
      const res = await fetch(`/delete/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.ok) {
        // Remove from local state
        setAllFiles(allFiles.filter(f => f.id !== fileId))
        // Refresh stats to update quota
        if (onRefreshStats) {
          await onRefreshStats()
        }
      } else {
        const data = await res.json()
        alert(`Erreur: ${data.error || 'Échec de la suppression'}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Erreur lors de la suppression du fichier')
    } finally {
      setIsDeletingFile(null)
    }
  }

  // Load all files when gallery is toggled on
  useEffect(() => {
    if (showGallery && allFiles.length === 0) {
      loadAllFiles()
    }
  }, [showGallery])

  return {
    allFiles,
    isLoadingFiles,
    isDeletingFile,
    loadAllFiles,
    deleteFile,
  }
}
