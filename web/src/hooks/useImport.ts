import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { api } from '../api';

export function useImport() {
  const [selectedPath, setSelectedPath] = useState('');
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs());
  const [dryRun, setDryRun] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: (params: { sourcePath: string; importDate: string; dryRun: boolean }) =>
      api.importPhotos(params.sourcePath, params.importDate, params.dryRun),
  });

  const handleDirectorySelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      const pathParts = firstFile.webkitRelativePath.split('/');
      const directoryName = pathParts[0];
      setSelectedPath(directoryName);
    }
  };

  const handleImport = () => {
    if (!selectedPath || !selectedDate) {
      return;
    }

    importMutation.mutate({
      sourcePath: selectedPath,
      importDate: selectedDate.format('YYYY-MM-DD'),
      dryRun,
    });
  };

  const isFormValid = Boolean(selectedPath && selectedDate);
  const isLoading = importMutation.isPending;

  return {
    // State
    selectedPath,
    selectedDate,
    dryRun,
    fileInputRef,
    
    // State setters
    setSelectedDate,
    setDryRun,
    
    // Handlers
    handleDirectorySelect,
    handleFileChange,
    handleImport,
    
    // Computed values
    isFormValid,
    isLoading,
    
    // Mutation state
    importMutation,
  };
}