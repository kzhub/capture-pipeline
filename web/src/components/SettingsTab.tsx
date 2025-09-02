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
import { useSettings } from '../hooks/useSettings';

export function SettingsTab() {
  const {
    config,
    showWarning,
    isInitialLoad,
    cachedAwsStatus,
    currentConfig,
    configLoading,
    awsStatus,
    saveMutation,
    handleSave,
    handleConfirmSave,
    handleConfigChange,
    setShowWarning,
    STORAGE_CLASSES,
  } = useSettings();

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
                    onChange={(e) => handleConfigChange('S3_BUCKET', e.target.value)}
                    required
                    helperText="写真を保存するS3バケット名"
                    fullWidth
                  />
                </Box>

                <FormControl fullWidth>
                  <InputLabel>ストレージクラス</InputLabel>
                  <Select
                    value={config.S3_STORAGE_CLASS}
                    onChange={(e) => handleConfigChange('S3_STORAGE_CLASS', e.target.value)}
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
                    onChange={(e) => handleConfigChange('AWS_REGION', e.target.value)}
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
                  onChange={(e) => handleConfigChange('S3_PREFIX_RAW', e.target.value)}
                  fullWidth
                />
                
                <TextField
                  label="JPGファイル用プレフィックス"
                  value={config.S3_PREFIX_JPG}
                  onChange={(e) => handleConfigChange('S3_PREFIX_JPG', e.target.value)}
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
                onChange={(e) => handleConfigChange('LOCAL_IMPORT_BASE', e.target.value)}
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