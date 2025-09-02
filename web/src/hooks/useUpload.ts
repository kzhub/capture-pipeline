import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { api } from '../api';

export function useUpload() {
  const [selectedPath, setSelectedPath] = useState('');
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check for active uploads on component mount and refresh
  const { data: activeUploads } = useQuery({
    queryKey: ['uploads'],
    queryFn: api.getUploads,
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Monitor specific upload if active
  const { data: uploadStatus } = useQuery({
    queryKey: ['upload', activeUploadId],
    queryFn: () => activeUploadId ? api.getUpload(activeUploadId) : null,
    enabled: !!activeUploadId,
    refetchInterval: 1000, // Refresh every second
  });

  // Restore active upload on component mount
  useEffect(() => {
    if (activeUploads && activeUploads.length > 0) {
      const runningUpload = activeUploads.find((upload: any) => 
        upload.status === 'running' || upload.status === 'interrupted'
      );
      if (runningUpload && !activeUploadId) {
        setActiveUploadId(runningUpload.id);
        setSelectedPath(runningUpload.sourcePath || '');
        if (runningUpload.startDate) {
          setStartDate(dayjs(runningUpload.startDate));
        }
        if (runningUpload.endDate) {
          setEndDate(dayjs(runningUpload.endDate));
        }
        setDryRun(runningUpload.dryRun || false);
      }
    }
  }, [activeUploads, activeUploadId]);

  const uploadMutation = useMutation({
    mutationFn: (params: { sourcePath: string; startDate?: string; endDate?: string; dryRun: boolean }) =>
      api.uploadPhotos(params.sourcePath, params.startDate, params.endDate, params.dryRun),
    onSuccess: (data) => {
      if (data.uploadId) {
        setActiveUploadId(data.uploadId);
      }
    },
  });

  const handleDirectorySelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      const pathParts = firstFile.webkitRelativePath.split('/');
      if (pathParts.length > 1) {
        const directoryName = pathParts[0];
        setSelectedPath(directoryName);
      }
    }
  };

  const handleUpload = () => {
    if (!selectedPath) {
      return;
    }

    const params: any = {
      sourcePath: selectedPath,
      dryRun,
    };

    if (startDate) {
      params.startDate = startDate.format('YYYY-MM-DD');
    }
    if (endDate) {
      params.endDate = endDate.format('YYYY-MM-DD');
    }

    uploadMutation.mutate(params);
  };

  const handleStop = async () => {
    if (activeUploadId) {
      try {
        await api.stopUpload(activeUploadId);
        setActiveUploadId(null);
      } catch (error) {
        console.error('Failed to stop upload:', error);
      }
    }
  };

  const handleResume = async () => {
    if (activeUploadId) {
      try {
        await api.resumeUpload(activeUploadId);
      } catch (error) {
        console.error('Failed to resume upload:', error);
      }
    }
  };

  const isFormValid = Boolean(selectedPath);
  const isLoading = uploadMutation.isPending;
  const hasActiveUpload = Boolean(activeUploadId && uploadStatus);
  const isUploadRunning = uploadStatus?.status === 'running';
  const isUploadInterrupted = uploadStatus?.status === 'interrupted';

  return {
    // State
    selectedPath,
    startDate,
    endDate,
    dryRun,
    activeUploadId,
    fileInputRef,
    
    // State setters
    setStartDate,
    setEndDate,
    setDryRun,
    
    // Query data
    activeUploads,
    uploadStatus,
    
    // Handlers
    handleDirectorySelect,
    handleFileChange,
    handleUpload,
    handleStop,
    handleResume,
    
    // Computed values
    isFormValid,
    isLoading,
    hasActiveUpload,
    isUploadRunning,
    isUploadInterrupted,
    
    // Mutations
    uploadMutation,
  };
}