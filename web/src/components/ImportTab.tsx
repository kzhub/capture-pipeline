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
import { FolderOpen, Upload } from '@mui/icons-material';
import dayjs, { Dayjs } from 'dayjs';
import { api } from '../api';

export function ImportTab() {
  const [selectedPath, setSelectedPath] = useState('');
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(dayjs());
  const [dryRun, setDryRun] = useState(true);

  const { data: volumes, isLoading: volumesLoading } = useQuery({
    queryKey: ['volumes'],
    queryFn: api.getVolumes,
  });

  const importMutation = useMutation({
    mutationFn: (params: { sourcePath: string; importDate: string; dryRun: boolean }) =>
      api.importPhotos(params.sourcePath, params.importDate, params.dryRun),
  });

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

  return (
    <Card elevation={2}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
          SDカード/カメラから写真を取り込み
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
          指定した日付の写真のみを取り込み、自動的にS3にアップロードします
        </Typography>

        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
          gap: 4, 
          mb: 4 
        }}>
          <FormControl fullWidth>
            <InputLabel>取り込み元ディレクトリ</InputLabel>
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

          <DatePicker
            label="取り込み対象日"
            value={selectedDate}
            onChange={setSelectedDate}
            format="YYYY-MM-DD"
            slotProps={{
              textField: { 
                fullWidth: true, 
                helperText: 'この日付に撮影された写真のみを取り込みます' 
              }
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
            onClick={handleImport}
            disabled={!selectedPath || !selectedDate || importMutation.isPending}
            startIcon={
              importMutation.isPending ? (
                <CircularProgress size={20} />
              ) : (
                <Upload />
              )
            }
            size="large"
            sx={{ px: 4, py: 1.5 }}
          >
            {dryRun ? '実行内容を確認' : '取り込み開始'}
          </Button>
        </Box>

        {(importMutation.isError || importMutation.isSuccess || importMutation.data?.output) && (
          <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {importMutation.isError && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                エラーが発生しました: {importMutation.error?.message}
              </Alert>
            )}

            {importMutation.isSuccess && (
              <Alert severity="success" sx={{ borderRadius: 2 }}>
                {dryRun ? '実行内容の確認が完了しました' : '取り込みが完了しました'}
              </Alert>
            )}

            {importMutation.data?.output && (
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
                    {importMutation.data.output}
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