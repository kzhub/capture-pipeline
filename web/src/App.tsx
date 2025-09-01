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
    secondary: {
      main: '#dc004e',
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
      defaultProps: {
        disableRipple: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
          '&:focus': {
            outline: 'none',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          backgroundColor: '#ffffff',
          color: '#1976d2',
          borderBottom: '1px solid #e2e8f0',
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 48,
          height: 48,
        },
        indicator: {
          backgroundColor: '#1976d2',
          height: 2,
        },
      },
    },
    MuiTab: {
      defaultProps: {
        disableRipple: true,
        disableTouchRipple: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          color: '#4a5568',
          minHeight: 48,
          height: 48,
          transition: 'color 0.2s ease',
          overflow: 'hidden',
          '&.Mui-selected': {
            color: '#1976d2',
            fontWeight: 600,
          },
          '&:hover': {
            color: '#1976d2',
            backgroundColor: 'transparent',
          },
          '&:focus': {
            outline: '2px solid #1976d2',
            outlineOffset: '2px',
            backgroundColor: 'transparent',
          },
          '& .MuiTouchRipple-root': {
            display: 'none !important',
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

            <Box sx={{ flex: 1, width: '100vw' }}>
              <Box sx={{ 
                borderBottom: 1, 
                borderColor: 'divider', 
                mb: 3,
                position: 'sticky',
                top: 0,
                backgroundColor: 'background.default',
                zIndex: 1,
                width: '100%'
              }}>
                <Tabs 
                  value={activeTab} 
                  onChange={handleTabChange}
                  variant="fullWidth"
                >
                  <Tab 
                    label="SDカードから取り込み" 
                    value="import"
                  />
                  <Tab 
                    label="ローカルからアップロード" 
                    value="upload"
                  />
                  <Tab 
                    label="設定" 
                    value="settings"
                  />
                </Tabs>
              </Box>

              <Box sx={{ 
                minHeight: 'calc(100vh - 180px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                px: 3,
                py: 3
              }}>
                <Box sx={{ 
                  width: '100%', 
                  maxWidth: '900px',
                  minWidth: '800px'
                }}>
                  {activeTab === 'import' && <ImportTab />}
                  {activeTab === 'upload' && <UploadTab />}
                  {activeTab === 'settings' && <SettingsTab />}
                </Box>
              </Box>
            </Box>
          </Box>
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;