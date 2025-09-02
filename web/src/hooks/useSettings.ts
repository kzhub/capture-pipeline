import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../api';

export const STORAGE_CLASSES = [
  { value: 'STANDARD', label: 'Standard（標準）', cost: '高' },
  { value: 'STANDARD_IA', label: 'Standard-IA（低頻度アクセス）', cost: '中' },
  { value: 'GLACIER', label: 'Glacier（アーカイブ）', cost: '低' },
  { value: 'DEEP_ARCHIVE', label: 'Deep Archive（長期アーカイブ）', cost: '最低' },
];

// SessionStorageキー
const CACHE_KEY = 'photo-backup-config-cache';
const AWS_STATUS_CACHE_KEY = 'photo-backup-aws-status-cache';

// SessionStorageからキャッシュを取得
const getCachedData = (key: string) => {
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) {
      const data = JSON.parse(cached);
      // 10分以内のキャッシュのみ有効
      if (Date.now() - data.timestamp < 10 * 60 * 1000) {
        return data.value;
      }
    }
  } catch (error) {
    console.error('Failed to load cache:', error);
  }
  return null;
};

// SessionStorageにキャッシュを保存
const setCachedData = (key: string, value: any) => {
  try {
    sessionStorage.setItem(key, JSON.stringify({
      value,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Failed to save cache:', error);
  }
};

export function useSettings() {
  // キャッシュから初期値を取得
  const cachedConfig = getCachedData(CACHE_KEY);
  const cachedAwsStatus = getCachedData(AWS_STATUS_CACHE_KEY);
  
  const [config, setConfig] = useState(cachedConfig || {
    S3_BUCKET: '',
    LOCAL_IMPORT_BASE: '',
    S3_STORAGE_CLASS: 'DEEP_ARCHIVE',
    S3_PREFIX_RAW: 'raw',
    S3_PREFIX_JPG: 'jpg',
    AWS_REGION: 'ap-northeast-1',
  });
  const [showWarning, setShowWarning] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(!cachedConfig);

  const { data: currentConfig, isLoading: configLoading, refetch } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
    // キャッシュがある場合は背景で更新
    staleTime: cachedConfig ? 0 : undefined,
    refetchOnMount: true,
  });

  // Update config when data is loaded and cache it
  useEffect(() => {
    if (currentConfig?.configured) {
      // キャッシュを更新
      setCachedData(CACHE_KEY, currentConfig);
      
      // 差分がある場合のみ更新（再レンダリング）
      const hasChanges = JSON.stringify(config) !== JSON.stringify(currentConfig);
      if (hasChanges) {
        setConfig(currentConfig);
      }
      
      // 初回ロード完了
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    }
  }, [currentConfig, config, isInitialLoad]);

  const { data: awsStatus } = useQuery({
    queryKey: ['aws-status'],
    queryFn: api.checkAWS,
    // キャッシュがある場合は背景で更新
    staleTime: cachedAwsStatus ? 0 : undefined,
    refetchOnMount: true,
  });
  
  // AWS Statusもキャッシュを更新
  useEffect(() => {
    if (awsStatus !== undefined) {
      setCachedData(AWS_STATUS_CACHE_KEY, awsStatus);
    }
  }, [awsStatus]);

  const saveMutation = useMutation({
    mutationFn: api.saveConfig,
    onSuccess: (data) => {
      // キャッシュを更新
      setCachedData(CACHE_KEY, { ...config, ...data });
      refetch();
    },
  });

  const handleSave = () => {
    // Deep Archiveを選択した場合は警告を表示
    if (config.S3_STORAGE_CLASS === 'DEEP_ARCHIVE') {
      setShowWarning(true);
    } else {
      saveMutation.mutate(config);
    }
  };

  const handleConfirmSave = () => {
    setShowWarning(false);
    saveMutation.mutate(config);
  };

  const handleConfigChange = (key: string, value: string) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
  };

  return {
    // State
    config,
    showWarning,
    isInitialLoad,
    
    // Cached data
    cachedAwsStatus,
    
    // Query data
    currentConfig,
    configLoading,
    awsStatus,
    
    // Mutations
    saveMutation,
    
    // Handlers
    handleSave,
    handleConfirmSave,
    handleConfigChange,
    setShowWarning,
    
    // Utils
    STORAGE_CLASSES,
  };
}