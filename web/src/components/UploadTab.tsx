import { useState } from 'react';
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
  Switch,
  FormControlLabel,
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

  const { data: volumes, isLoading: volumesLoading } = useQuery({
    queryKey: ['volumes'],
    queryFn: api.getVolumes,
  });

  const uploadMutation = useMutation({
    mutationFn: (params: { 
      sourcePath: string; 
      startDate?: string; 
      endDate?: string; 
      dryRun: boolean 
    }) => api.uploadPhotos(params.sourcePath, params.startDate, params.endDate, params.dryRun),
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
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          ローカルフォルダからS3へアップロード
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          ローカルに保存済みの写真をS3にアップロードします
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 3 }}>
          <FormControl fullWidth>
            <InputLabel>アップロード元ディレクトリ</InputLabel>
            <Select
              value={selectedPath}
              onChange={(e) => setSelectedPath(e.target.value)}
              startAdornment={<FolderOpen sx={{ mr: 1 }} />}
              disabled={volumesLoading}
            >
              {volumes?.map((volume) => (
                <MenuItem key={volume.path} value={volume.path}>
                  {volume.name} ({volume.path})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 2 }}>
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

          <FormControlLabel
            control={
              <Switch
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
              />
            }
            label="ドライラン（確認のみ、実際には実行しない）"
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
          >
            {dryRun ? '実行内容を確認' : 'アップロード開始'}
          </Button>

          {uploadMutation.isError && (
            <Alert severity="error">
              エラーが発生しました: {uploadMutation.error?.message}
            </Alert>
          )}

          {uploadMutation.isSuccess && (
            <Alert severity="success">
              {dryRun ? '実行内容の確認が完了しました' : 'アップロードが完了しました'}
            </Alert>
          )}

          {uploadMutation.data?.output && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  実行結果:
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    backgroundColor: 'grey.100',
                    p: 2,
                    borderRadius: 1,
                    maxHeight: 400,
                    overflow: 'auto',
                  }}
                >
                  {uploadMutation.data.output}
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}