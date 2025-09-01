import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ImportTab } from '../ImportTab';
import { vi } from 'vitest';

// Mock the API
vi.mock('../../api', () => ({
  api: {
    getVolumes: vi.fn().mockResolvedValue([
      { name: 'EOS_DIGITAL', path: '/Volumes/EOS_DIGITAL', type: 'volume' },
      { name: 'Desktop', path: '/Users/test/Desktop', type: 'folder' },
    ]),
    importPhotos: vi.fn().mockResolvedValue({
      success: true,
      output: 'Import completed successfully'
    }),
  },
}));

const theme = createTheme();

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          {children}
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('ImportTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders import tab with all form elements', async () => {
    render(
      <TestWrapper>
        <ImportTab />
      </TestWrapper>
    );

    expect(screen.getByText('SDカード/カメラから写真を取り込み')).toBeInTheDocument();
    expect(screen.getByLabelText('取り込み元ディレクトリ')).toBeInTheDocument();
    expect(screen.getByLabelText('取り込み対象日')).toBeInTheDocument();
    expect(screen.getByLabelText('ドライラン（確認のみ、実際には実行しない）')).toBeInTheDocument();
  });

  test('loads and displays volume options', async () => {
    render(
      <TestWrapper>
        <ImportTab />
      </TestWrapper>
    );

    await waitFor(() => {
      fireEvent.mouseDown(screen.getByLabelText('取り込み元ディレクトリ'));
    });

    expect(await screen.findByText('EOS_DIGITAL (/Volumes/EOS_DIGITAL)')).toBeInTheDocument();
    expect(screen.getByText('Desktop (/Users/test/Desktop)')).toBeInTheDocument();
  });

  test('enables import button when form is valid', async () => {
    const { api } = await import('../../api');
    
    render(
      <TestWrapper>
        <ImportTab />
      </TestWrapper>
    );

    // Wait for volumes to load
    await waitFor(() => {
      expect(api.getVolumes).toHaveBeenCalled();
    });

    // Select a directory
    fireEvent.mouseDown(screen.getByLabelText('取り込み元ディレクトリ'));
    const option = await screen.findByText('EOS_DIGITAL (/Volumes/EOS_DIGITAL)');
    fireEvent.click(option);

    // Button should be enabled now
    const importButton = screen.getByRole('button', { name: /実行内容を確認/ });
    expect(importButton).not.toBeDisabled();
  });

  test('calls import API when form is submitted', async () => {
    const { api } = await import('../../api');
    
    render(
      <TestWrapper>
        <ImportTab />
      </TestWrapper>
    );

    // Wait for volumes to load and select directory
    await waitFor(() => {
      fireEvent.mouseDown(screen.getByLabelText('取り込み元ディレクトリ'));
    });
    
    const option = await screen.findByText('EOS_DIGITAL (/Volumes/EOS_DIGITAL)');
    fireEvent.click(option);

    // Click import button
    const importButton = screen.getByRole('button', { name: /実行内容を確認/ });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(api.importPhotos).toHaveBeenCalledWith(
        '/Volumes/EOS_DIGITAL',
        expect.any(String), // Date string
        true // dryRun default
      );
    });
  });

  test('displays success message after successful import', async () => {
    render(
      <TestWrapper>
        <ImportTab />
      </TestWrapper>
    );

    // Select directory and submit
    await waitFor(() => {
      fireEvent.mouseDown(screen.getByLabelText('取り込み元ディレクトリ'));
    });
    
    const option = await screen.findByText('EOS_DIGITAL (/Volumes/EOS_DIGITAL)');
    fireEvent.click(option);

    const importButton = screen.getByRole('button', { name: /実行内容を確認/ });
    fireEvent.click(importButton);

    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText('実行内容の確認が完了しました')).toBeInTheDocument();
    });
  });
});