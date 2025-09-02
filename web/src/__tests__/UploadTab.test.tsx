import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { UploadTab } from '../components/UploadTab';
import { vi } from 'vitest';

// Mock the API
vi.mock('../api', () => ({
  api: {
    getUploads: vi.fn().mockResolvedValue([]),
    getUpload: vi.fn().mockResolvedValue(null),
    uploadPhotos: vi.fn().mockResolvedValue({
      success: true,
      uploadId: 'test-upload-id',
      output: 'Upload completed successfully'
    }),
    stopUpload: vi.fn().mockResolvedValue({ success: true }),
    resumeUpload: vi.fn().mockResolvedValue({ success: true }),
  },
}));

const theme = createTheme();

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchInterval: false,
      },
      mutations: {
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

describe('UploadTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders upload tab with all form elements', async () => {
    render(
      <TestWrapper>
        <UploadTab />
      </TestWrapper>
    );

    expect(screen.getByText('ローカルフォルダからS3へアップロード')).toBeInTheDocument();
    expect(screen.getByText('アップロード元ディレクトリを選択')).toBeInTheDocument();
    expect(screen.getByLabelText('ドライラン（確認のみ、実際には実行しない）')).toBeInTheDocument();
    
    // Check for date pickers
    expect(screen.getByLabelText('開始日（オプション）')).toBeInTheDocument();
    expect(screen.getByLabelText('終了日（オプション）')).toBeInTheDocument();
  });

  test('allows directory selection via file input', async () => {
    render(
      <TestWrapper>
        <UploadTab />
      </TestWrapper>
    );

    const button = screen.getByText('アップロード元ディレクトリを選択');
    expect(button).toBeInTheDocument();

    // Check for file input with webkitdirectory
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('webkitdirectory');
  });

  test('enables upload button when form is valid', async () => {
    render(
      <TestWrapper>
        <UploadTab />
      </TestWrapper>
    );

    // Initially button should be disabled
    const uploadButton = screen.getByRole('button', { name: /実行内容を確認|アップロード開始/ });
    expect(uploadButton).toBeDisabled();

    // Simulate directory selection
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = new File([''], 'test/photo.jpg');
    Object.defineProperty(mockFile, 'webkitRelativePath', {
      value: 'TestDirectory/subfolder/photo.jpg',
      writable: false,
    });
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false,
    });
    fireEvent.change(fileInput);

    // Button should be enabled now
    await waitFor(() => {
      expect(uploadButton).not.toBeDisabled();
    });
  });

  test('calls upload API when form is submitted', async () => {
    const { api } = await import('../api');
    
    render(
      <TestWrapper>
        <UploadTab />
      </TestWrapper>
    );

    // Simulate directory selection
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const mockFile = new File([''], 'test/photo.jpg');
    Object.defineProperty(mockFile, 'webkitRelativePath', {
      value: 'TestDirectory/subfolder/photo.jpg',
      writable: false,
    });
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false,
    });
    fireEvent.change(fileInput);

    // Click upload button
    const uploadButton = screen.getByRole('button', { name: /実行内容を確認|アップロード開始/ });
    await waitFor(() => {
      expect(uploadButton).not.toBeDisabled();
    });
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(api.uploadPhotos).toHaveBeenCalledWith(
        'TestDirectory',
        undefined,
        undefined,
        true // dryRun default
      );
    });
  });

  test('handles dry run toggle', async () => {
    const { api } = await import('../api');
    
    render(
      <TestWrapper>
        <UploadTab />
      </TestWrapper>
    );

    // Toggle dry run off
    const dryRunToggle = screen.getByLabelText('ドライラン（確認のみ、実際には実行しない）');
    fireEvent.click(dryRunToggle);

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

    // Click upload button
    const uploadButton = screen.getByRole('button', { name: /アップロード開始/ });
    await waitFor(() => {
      expect(uploadButton).not.toBeDisabled();
    });
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(api.uploadPhotos).toHaveBeenCalledWith(
        'TestDirectory',
        undefined,
        undefined,
        false // dryRun turned off
      );
    });
  });

  test('displays success message after successful upload', async () => {
    render(
      <TestWrapper>
        <UploadTab />
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

    const uploadButton = screen.getByRole('button', { name: /実行内容を確認/ });
    await waitFor(() => {
      expect(uploadButton).not.toBeDisabled();
    });
    fireEvent.click(uploadButton);

    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText('実行内容の確認が完了しました')).toBeInTheDocument();
    });
  });

  test('handles date range selection', async () => {
    const { api } = await import('../api');
    
    render(
      <TestWrapper>
        <UploadTab />
      </TestWrapper>
    );

    // Set date inputs
    const startDateInput = screen.getByLabelText('開始日（オプション）');
    const endDateInput = screen.getByLabelText('終了日（オプション）');
    
    fireEvent.change(startDateInput, { target: { value: '2023-12-01' } });
    fireEvent.change(endDateInput, { target: { value: '2023-12-31' } });

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

    const uploadButton = screen.getByRole('button', { name: /実行内容を確認/ });
    await waitFor(() => {
      expect(uploadButton).not.toBeDisabled();
    });
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(api.uploadPhotos).toHaveBeenCalledWith(
        'TestDirectory',
        '2023-12-01',
        '2023-12-31',
        true
      );
    });
  });
});