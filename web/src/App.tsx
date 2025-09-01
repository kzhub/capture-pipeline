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
          <AppBar position="static" sx={{ mb: 3 }}>
            <Toolbar>
              <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
                Photo S3 Backup
              </Typography>
            </Toolbar>
          </AppBar>

          <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs 
                value={activeTab} 
                onChange={handleTabChange}
                variant="fullWidth"
                sx={{ minHeight: 48 }}
              >
                <Tab 
                  label="SDカードから取り込み" 
                  value="import"
                  sx={{ minHeight: 48, fontSize: '0.9rem' }}
                />
                <Tab 
                  label="ローカルからアップロード" 
                  value="upload"
                  sx={{ minHeight: 48, fontSize: '0.9rem' }}
                />
                <Tab 
                  label="設定" 
                  value="settings"
                  sx={{ minHeight: 48, fontSize: '0.9rem' }}
                />
              </Tabs>
            </Box>

            <Box sx={{ px: { xs: 1, sm: 2 } }}>
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