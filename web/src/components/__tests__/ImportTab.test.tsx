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
    expect(screen.getByText('取り込み元ディレクトリを選択')).toBeInTheDocument();
    // DatePicker creates multiple elements with the same text, so we check if at least one exists
    expect(screen.getAllByText('取り込み対象日').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('ドライラン（確認のみ、実際には実行しない）')).toBeInTheDocument();
  });

  test('allows directory selection via file input', async () => {
    render(
      <TestWrapper>
        <ImportTab />
      </TestWrapper>
    );

    const button = screen.getByText('取り込み元ディレクトリを選択');
    expect(button).toBeInTheDocument();

    // Simulate file selection
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('webkitdirectory');
  });

  test('enables import button when form is valid', async () => {
    render(
      <TestWrapper>
        <ImportTab />
      </TestWrapper>
    );

    // Initially button should be disabled
    const importButton = screen.getByRole('button', { name: /実行内容を確認/ });
    expect(importButton).toBeDisabled();

    // Simulate directory selection
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = new File([''], 'test/photo.jpg');
    Object.defineProperty(mockFile, 'webkitRelativePath', {
      value: 'TestDirectory/photo.jpg',
      writable: false,
    });
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false,
    });
    fireEvent.change(fileInput);

    // Button should be enabled now
    await waitFor(() => {
      expect(importButton).not.toBeDisabled();
    });
  });

  test('calls import API when form is submitted', async () => {
    const { api } = await import('../../api');
    
    render(
      <TestWrapper>
        <ImportTab />
      </TestWrapper>
    );

    // Simulate directory selection
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = new File([''], 'test/photo.jpg');
    Object.defineProperty(mockFile, 'webkitRelativePath', {
      value: 'TestDirectory/photo.jpg',
      writable: false,
    });
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false,
    });
    fireEvent.change(fileInput);

    // Click import button
    const importButton = screen.getByRole('button', { name: /実行内容を確認/ });
    await waitFor(() => {
      expect(importButton).not.toBeDisabled();
    });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(api.importPhotos).toHaveBeenCalledWith(
        'TestDirectory',
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

    // Simulate directory selection
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = new File([''], 'test/photo.jpg');
    Object.defineProperty(mockFile, 'webkitRelativePath', {
      value: 'TestDirectory/photo.jpg',
      writable: false,
    });
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false,
    });
    fireEvent.change(fileInput);

    const importButton = screen.getByRole('button', { name: /実行内容を確認/ });
    await waitFor(() => {
      expect(importButton).not.toBeDisabled();
    });
    fireEvent.click(importButton);

    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText('実行内容の確認が完了しました')).toBeInTheDocument();
    });
  });
});