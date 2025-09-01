import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Container, AppBar, Toolbar, Typography, Tabs, Tab, Box } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ImportTab } from './components/ImportTab';
import { UploadTab } from './components/UploadTab';
import { SettingsTab } from './components/SettingsTab';
import 'dayjs/locale/ja';

const queryClient = new QueryClient();

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
  },
});

type TabType = 'import' | 'upload' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('import');

  const handleTabChange = (_: React.SyntheticEvent, newValue: TabType) => {
    setActiveTab(newValue);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="ja">
          <CssBaseline />
          <AppBar position="static">
            <Toolbar>
              <Typography variant="h5" component="h1" sx={{ flexGrow: 1 }}>
                📸 Photo S3 Backup
              </Typography>
              <Typography variant="subtitle1">
                写真をS3に安全にバックアップ
              </Typography>
            </Toolbar>
          </AppBar>

          <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={activeTab} onChange={handleTabChange}>
                <Tab label="SDカードから取り込み" value="import" />
                <Tab label="ローカルからアップロード" value="upload" />
                <Tab label="設定" value="settings" />
              </Tabs>
            </Box>

            <Box sx={{ mt: 3 }}>
              {activeTab === 'import' && <ImportTab />}
              {activeTab === 'upload' && <UploadTab />}
              {activeTab === 'settings' && <SettingsTab />}
            </Box>
          </Container>
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;