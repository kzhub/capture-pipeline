import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Box,
  CircularProgress,
  Switch,
  FormControlLabel,
  LinearProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { CloudUpload, FolderOpen } from '@mui/icons-material';
import dayjs, { Dayjs } from 'dayjs';
import { api } from '../api';

export function UploadTab() {
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

  const handleDirectorySelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      // webkitRelativePathから完全パスを構築
      const pathParts = firstFile.webkitRelativePath.split('/');
      if (pathParts.length > 1) {
        // ファイルが選択された場合、そのディレクトリの完全パスを推測
        // ブラウザのセキュリティ制限により、実際のパスは取得できないため、
        // 選択されたディレクトリ名のみを表示し、サーバーサイドで解決する
        const directoryName = pathParts[0];
        setSelectedPath(directoryName);
      }
    }
  };

  const uploadMutation = useMutation({
    mutationFn: (params: { 
      sourcePath: string; 
      startDate?: string; 
      endDate?: string; 
      dryRun: boolean 
    }) => api.uploadPhotos(params.sourcePath, params.startDate, params.endDate, params.dryRun),
    onSuccess: (data) => {
      if (data.uploadId) {
        setActiveUploadId(data.uploadId);
      }
    },
  });

  const handleUpload = () => {
    if (!selectedPath) {
      return;
    }

    uploadMutation.mutate({
      sourcePath: selectedPath,
      startDate: startDate?.format('YYYY-MM-DD'),
      endDate: endDate?.format('YYYY-MM-DD'),
      dryRun,
    });
  };

  return (
    <Card elevation={0} sx={{ height: 'fit-content' }}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          ローカルフォルダからS3へアップロード
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
          ローカルに保存済みの写真をS3にアップロードします
        </Typography>

        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
          gap: 4, 
          mb: 4 
        }}>
          <Box>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              webkitdirectory=""
              directory=""
              multiple
            />
            <Button
              variant="outlined"
              onClick={handleDirectorySelect}
              startIcon={<FolderOpen />}
              fullWidth
              sx={{ 
                justifyContent: 'flex-start', 
                textAlign: 'left',
                height: '56px'
              }}
            >
              {selectedPath || 'アップロード元ディレクトリを選択'}
            </Button>
          </Box>

          <DatePicker
            label="開始日（オプション）"
            value={startDate}
            onChange={setStartDate}
            format="YYYY-MM-DD"
            slotProps={{
              textField: { fullWidth: true }
            }}
          />
          
          <DatePicker
            label="終了日（オプション）"
            value={endDate}
            onChange={setEndDate}
            format="YYYY-MM-DD"
            slotProps={{
              textField: { fullWidth: true }
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
          <FormControlLabel
            control={
              <Switch
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                color="primary"
              />
            }
            label="ドライラン（確認のみ、実際には実行しない）"
            sx={{ mb: 2 }}
          />

          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!selectedPath || uploadMutation.isPending}
            startIcon={
              uploadMutation.isPending ? (
                <CircularProgress size={20} />
              ) : (
                <CloudUpload />
              )
            }
            size="large"
            sx={{ px: 4, py: 1.5 }}
          >
            {dryRun ? '実行内容を確認' : 'アップロード開始'}
          </Button>
        </Box>

        {/* Active Upload Status */}
        {activeUploadId && uploadStatus && (
          <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  アップロード進行状況
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Status: {uploadStatus.status} {uploadStatus.currentFile && `| Current: ${uploadStatus.currentFile}`}
                </Typography>
                
                {uploadStatus.progress && uploadStatus.progress.total > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={(uploadStatus.progress.completed / uploadStatus.progress.total) * 100}
                      sx={{ height: 8, borderRadius: 1 }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {uploadStatus.progress.completed} / {uploadStatus.progress.total} files 
                      {uploadStatus.progress.skipped > 0 && ` (${uploadStatus.progress.skipped} skipped)`}
                    </Typography>
                  </Box>
                )}

                {uploadStatus.status === 'completed' && (
                  <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }}>
                    アップロードが完了しました
                  </Alert>
                )}

                {uploadStatus.status === 'failed' && (
                  <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
                    アップロードでエラーが発生しました
                  </Alert>
                )}

                {uploadStatus.status === 'interrupted' && (
                  <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                    アップロードが中断されました（サーバー再起動）
                  </Alert>
                )}

                {uploadStatus.output && (
                  <Box
                    component="pre"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      backgroundColor: 'grey.50',
                      p: 2,
                      mt: 2,
                      borderRadius: 1,
                      maxHeight: 200,
                      overflow: 'auto',
                      border: '1px solid',
                      borderColor: 'grey.200',
                    }}
                  >
                    {uploadStatus.output}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>
        )}

        {(uploadMutation.isError || uploadMutation.isSuccess || (uploadMutation.data as any)?.output) && (
          <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {uploadMutation.isError && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                エラーが発生しました: {uploadMutation.error?.message}
              </Alert>
            )}

            {uploadMutation.isSuccess && (
              <Alert severity="success" sx={{ borderRadius: 2 }}>
                {dryRun ? '実行内容の確認が完了しました' : 'アップロードが完了しました'}
              </Alert>
            )}

            {(uploadMutation.data as any)?.output && (
              <Card variant="outlined" sx={{ mt: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    実行結果
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.875rem',
                      fontFamily: 'monospace',
                      backgroundColor: 'grey.50',
                      p: 3,
                      borderRadius: 2,
                      maxHeight: 400,
                      overflow: 'auto',
                      border: '1px solid',
                      borderColor: 'grey.200',
                    }}
                  >
                    {(uploadMutation.data as any).output}
                  </Box>
                </CardContent>
              </Card>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}