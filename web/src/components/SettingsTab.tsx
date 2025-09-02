import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Settings, Save, CheckCircle, Error, Warning } from '@mui/icons-material';
import { api } from '../api';

const STORAGE_CLASSES = [
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

export function SettingsTab() {
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
  }, [currentConfig]);

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

  // 初回ロード時のみローディングを表示（キャッシュがない場合）
  if (isInitialLoad && configLoading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="calc(100vh - 180px)"
        width="100%"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Card elevation={0} sx={{ height: 'fit-content' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
            <Settings sx={{ mr: 1 }} />
            設定
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, mt: 3 }}>
            {/* AWS Status */}
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  AWS接続状態
                  {configLoading && !isInitialLoad && (
                    <CircularProgress size={16} sx={{ ml: 1 }} />
                  )}
                </Typography>
                {(awsStatus || cachedAwsStatus)?.configured ? (
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle color="success" />
                    <Box>
                      <Typography color="success.main">
                        設定済み
                      </Typography>
                      {(awsStatus || cachedAwsStatus)?.identity?.Arn && (
                        <Typography variant="body2" color="text.secondary">
                          {(awsStatus || cachedAwsStatus).identity.Arn}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ) : (
                  <Box display="flex" alignItems="center" gap={1}>
                    <Error color="error" />
                    <Typography color="error.main">
                      未設定
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* S3設定 */}
            <Box>
              <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                S3設定
              </Typography>
              
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
                gap: 3 
              }}>
                <Box sx={{ gridColumn: { xs: '1', md: '1 / -1' } }}>
                  <TextField
                    label="S3バケット名"
                    value={config.S3_BUCKET}
                    onChange={(e) => setConfig((prev: any) => ({ ...prev, S3_BUCKET: e.target.value }))}
                    required
                    helperText="写真を保存するS3バケット名"
                    fullWidth
                  />
                </Box>

                <FormControl fullWidth>
                  <InputLabel>ストレージクラス</InputLabel>
                  <Select
                    value={config.S3_STORAGE_CLASS}
                    onChange={(e) => setConfig((prev: any) => ({ ...prev, S3_STORAGE_CLASS: e.target.value }))}
                  >
                    {STORAGE_CLASSES.map((storage) => (
                      <MenuItem key={storage.value} value={storage.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {storage.label}
                          <Chip
                            size="small"
                            label={`コスト: ${storage.cost}`}
                            color={storage.cost === '最低' ? 'success' : 'default'}
                            sx={{ ml: 1 }}
                          />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>AWSリージョン</InputLabel>
                  <Select
                    value={config.AWS_REGION}
                    onChange={(e) => setConfig((prev: any) => ({ ...prev, AWS_REGION: e.target.value }))}
                  >
                    <MenuItem value="ap-northeast-1">Asia Pacific (Tokyo)</MenuItem>
                    <MenuItem value="us-east-1">US East (N. Virginia)</MenuItem>
                    <MenuItem value="us-west-2">US West (Oregon)</MenuItem>
                    <MenuItem value="eu-west-1">Europe (Ireland)</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  label="RAWファイル用プレフィックス"
                  value={config.S3_PREFIX_RAW}
                  onChange={(e) => setConfig((prev: any) => ({ ...prev, S3_PREFIX_RAW: e.target.value }))}
                  fullWidth
                />
                
                <TextField
                  label="JPGファイル用プレフィックス"
                  value={config.S3_PREFIX_JPG}
                  onChange={(e) => setConfig((prev: any) => ({ ...prev, S3_PREFIX_JPG: e.target.value }))}
                  fullWidth
                />
              </Box>
            </Box>

            <Divider />

            {/* ローカル設定 */}
            <Box>
              <Typography variant="h6" gutterBottom>
                ローカル設定
              </Typography>
              
              <TextField
                label="取り込み先ディレクトリ"
                value={config.LOCAL_IMPORT_BASE}
                onChange={(e) => setConfig((prev: any) => ({ ...prev, LOCAL_IMPORT_BASE: e.target.value }))}
                required
                helperText="SDカードから取り込む際の保存先"
                fullWidth
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-start', mt: 2 }}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                startIcon={
                  saveMutation.isPending ? (
                    <CircularProgress size={20} />
                  ) : (
                    <Save />
                  )
                }
                size="large"
                sx={{ px: 4, py: 1.5 }}
              >
                設定を保存
              </Button>
            </Box>

            {saveMutation.isError && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                設定の保存に失敗しました: {saveMutation.error?.message}
              </Alert>
            )}

            {saveMutation.isSuccess && (
              <Alert severity="success" sx={{ borderRadius: 2 }}>
                設定を保存しました
              </Alert>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Deep Archive警告ダイアログ */}
      <Dialog open={showWarning} onClose={() => setShowWarning(false)}>
        <DialogTitle>
          <Warning color="warning" sx={{ mr: 1, verticalAlign: 'middle' }} />
          Deep Archive設定について
        </DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Deep Archiveを選択しました。以下の点にご注意ください：
          </Typography>
          <Box component="ul" sx={{ pl: 2 }}>
            <li>最低12時間の保存期間制約があります</li>
            <li>データの取得に12時間以上かかる場合があります</li>
            <li>頻繁にアクセスする場合は追加料金が発生します</li>
            <li>長期保存に最適ですが、すぐにアクセスが必要な場合は他のストレージクラスを推奨します</li>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowWarning(false)}>
            キャンセル
          </Button>
          <Button onClick={handleConfirmSave} variant="contained" color="warning">
            理解して保存
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}