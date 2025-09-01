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
      main: '#2d3748',
    },
    secondary: {
      main: '#4a5568',
    },
    background: {
      default: '#f7fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#2d3748',
      secondary: '#4a5568',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 500,
    },
    h6: {
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
          border: '1px solid #e2e8f0',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          backgroundColor: '#ffffff',
          color: '#2d3748',
          borderBottom: '1px solid #e2e8f0',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 48,
        },
        indicator: {
          backgroundColor: '#2d3748',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          color: '#4a5568',
          '&.Mui-selected': {
            color: '#2d3748',
          },
        },
      },
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
          <Box sx={{ 
            minHeight: '100vh', 
            display: 'flex', 
            flexDirection: 'column',
            backgroundColor: 'background.default'
          }}>
            <AppBar position="static" elevation={0}>
              <Toolbar sx={{ height: 64 }}>
                <Typography variant="h6" component="h1" sx={{ flexGrow: 1, fontWeight: 500 }}>
                  Photo S3 Backup
                </Typography>
              </Toolbar>
            </AppBar>

            <Container 
              maxWidth={false}
              sx={{ 
                flex: 1, 
                py: 3,
                maxWidth: '1200px',
                minWidth: '800px',
                mx: 'auto',
                px: { xs: 2, sm: 3, md: 4 }
              }}
            >
              <Box sx={{ 
                borderBottom: 1, 
                borderColor: 'divider', 
                mb: 3,
                position: 'sticky',
                top: 0,
                backgroundColor: 'background.default',
                zIndex: 1,
                mx: -2
              }}>
                <Tabs 
                  value={activeTab} 
                  onChange={handleTabChange}
                  variant="fullWidth"
                  sx={{ 
                    minHeight: 48,
                    px: 2,
                    '& .MuiTabs-flexContainer': {
                      height: 48
                    }
                  }}
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

              <Box sx={{ 
                minHeight: 'calc(100vh - 180px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
              }}>
                <Box sx={{ width: '100%', maxWidth: '900px' }}>
                  {activeTab === 'import' && <ImportTab />}
                  {activeTab === 'upload' && <UploadTab />}
                  {activeTab === 'settings' && <SettingsTab />}
                </Box>
              </Box>
            </Container>
          </Box>
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;