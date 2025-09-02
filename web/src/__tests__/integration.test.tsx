import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { ImportTab } from '../components/ImportTab';
import { SettingsTab } from '../components/SettingsTab';
import { UploadTab } from '../components/UploadTab';
import { vi } from 'vitest';

// Mock the API for integration tests
vi.mock('../api', () => ({
  api: {
    // Import functionality
    importPhotos: vi.fn().mockResolvedValue({
      success: true,
      output: 'Import completed successfully'
    }),
    
    // Settings functionality
    getConfig: vi.fn().mockResolvedValue({
      configured: true,
      S3_BUCKET: 'test-bucket',
      LOCAL_IMPORT_BASE: '/Users/test/Desktop',
      S3_STORAGE_CLASS: 'DEEP_ARCHIVE',
      S3_PREFIX_RAW: 'raw',
      S3_PREFIX_JPG: 'jpg',
      AWS_REGION: 'ap-northeast-1',
    }),
    saveConfig: vi.fn().mockResolvedValue({ success: true }),
    checkAWS: vi.fn().mockResolvedValue({
      configured: true,
      identity: { Arn: 'arn:aws:iam::123456789:user/test' }
    }),
    
    // Upload functionality
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

describe('Integration Tests - Hook-Component Interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ImportTab Integration', () => {
    test('complete import workflow', async () => {
      const { api } = await import('../api');
      
      render(
        <TestWrapper>
          <ImportTab />
        </TestWrapper>
      );

      // Step 1: Select directory
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

      // Step 2: Verify directory appears in UI
      await waitFor(() => {
        expect(screen.getByDisplayValue('TestDirectory')).toBeInTheDocument();
      });

      // Step 3: Change dry run setting
      const dryRunToggle = screen.getByLabelText('ドライラン（確認のみ、実際には実行しない）');
      fireEvent.click(dryRunToggle);

      // Step 4: Execute import
      const importButton = screen.getByRole('button', { name: /アップロード開始/ });
      await waitFor(() => {
        expect(importButton).not.toBeDisabled();
      });
      fireEvent.click(importButton);

      // Step 5: Verify API call and success state
      await waitFor(() => {
        expect(api.importPhotos).toHaveBeenCalledWith(
          'TestDirectory',
          expect.any(String), // Date string
          false // dryRun turned off
        );
      });

      await waitFor(() => {
        expect(screen.getByText('取り込みが完了しました')).toBeInTheDocument();
      });
    });
  });

  describe('SettingsTab Integration', () => {
    test('complete settings workflow with Deep Archive warning', async () => {
      const { api } = await import('../api');
      
      render(
        <TestWrapper>
          <SettingsTab />
        </TestWrapper>
      );

      // Wait for settings to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('test-bucket')).toBeInTheDocument();
      });

      // Step 1: Verify AWS status is displayed
      expect(screen.getByText('設定済み')).toBeInTheDocument();
      expect(screen.getByText('arn:aws:iam::123456789:user/test')).toBeInTheDocument();

      // Step 2: Modify bucket name
      const bucketField = screen.getByDisplayValue('test-bucket');
      fireEvent.change(bucketField, { target: { value: 'new-bucket' } });

      // Step 3: Save with Deep Archive (should show warning)
      const saveButton = screen.getByRole('button', { name: /設定を保存/ });
      fireEvent.click(saveButton);

      // Step 4: Verify warning dialog appears
      await waitFor(() => {
        expect(screen.getByText('Deep Archive設定について')).toBeInTheDocument();
      });

      // Step 5: Confirm save
      const confirmButton = screen.getByRole('button', { name: /理解して保存/ });
      fireEvent.click(confirmButton);

      // Step 6: Verify API call
      await waitFor(() => {
        expect(api.saveConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            S3_BUCKET: 'new-bucket',
            S3_STORAGE_CLASS: 'DEEP_ARCHIVE',
          })
        );
      });
    });

    test('settings with different storage class (no warning)', async () => {
      const { api } = await import('../api');
      
      render(
        <TestWrapper>
          <SettingsTab />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('test-bucket')).toBeInTheDocument();
      });

      // Change storage class to Standard
      const storageSelect = screen.getByDisplayValue('Deep Archive（長期アーカイブ）');
      fireEvent.mouseDown(storageSelect);
      
      const standardOption = await screen.findByText('Standard（標準）');
      fireEvent.click(standardOption);

      // Save settings
      const saveButton = screen.getByRole('button', { name: /設定を保存/ });
      fireEvent.click(saveButton);

      // Should not show warning dialog
      await waitFor(() => {
        expect(api.saveConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            S3_STORAGE_CLASS: 'STANDARD',
          })
        );
      });

      // Warning dialog should not appear
      expect(screen.queryByText('Deep Archive設定について')).not.toBeInTheDocument();
    });
  });

  describe('UploadTab Integration', () => {
    test('complete upload workflow with date range', async () => {
      const { api } = await import('../api');
      
      render(
        <TestWrapper>
          <UploadTab />
        </TestWrapper>
      );

      // Step 1: Select directory
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const mockFile = new File([''], 'test/photo.jpg');
      Object.defineProperty(mockFile, 'webkitRelativePath', {
        value: 'UploadDirectory/subfolder/photo.jpg',
        writable: false,
      });
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false,
      });
      fireEvent.change(fileInput);

      // Step 2: Set date range
      const startDateInput = screen.getByLabelText('開始日（オプション）');
      const endDateInput = screen.getByLabelText('終了日（オプション）');
      
      fireEvent.change(startDateInput, { target: { value: '2023-12-01' } });
      fireEvent.change(endDateInput, { target: { value: '2023-12-31' } });

      // Step 3: Turn off dry run
      const dryRunToggle = screen.getByLabelText('ドライラン（確認のみ、実際には実行しない）');
      fireEvent.click(dryRunToggle);

      // Step 4: Execute upload
      const uploadButton = screen.getByRole('button', { name: /アップロード開始/ });
      await waitFor(() => {
        expect(uploadButton).not.toBeDisabled();
      });
      fireEvent.click(uploadButton);

      // Step 5: Verify API call with correct parameters
      await waitFor(() => {
        expect(api.uploadPhotos).toHaveBeenCalledWith(
          'UploadDirectory',
          '2023-12-01',
          '2023-12-31',
          false
        );
      });

      // Step 6: Verify success message
      await waitFor(() => {
        expect(screen.getByText('アップロードが完了しました')).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Component State Management', () => {
    test('components maintain independent state', async () => {
      // This test ensures that each component's hooks maintain their own state
      // and don't interfere with each other when mounted simultaneously
      
      const TestMultipleComponents = () => (
        <TestWrapper>
          <div>
            <div data-testid="import-tab">
              <ImportTab />
            </div>
            <div data-testid="upload-tab">
              <UploadTab />
            </div>
          </div>
        </TestWrapper>
      );

      render(<TestMultipleComponents />);

      // Both components should render without interference
      expect(screen.getByTestId('import-tab')).toBeInTheDocument();
      expect(screen.getByTestId('upload-tab')).toBeInTheDocument();

      // Each should have their own directory selection buttons
      const directoryButtons = screen.getAllByText(/ディレクトリを選択/);
      expect(directoryButtons.length).toBeGreaterThanOrEqual(2);

      // Each should have their own dry run toggles
      const dryRunToggles = screen.getAllByLabelText('ドライラン（確認のみ、実際には実行しない）');
      expect(dryRunToggles.length).toBe(2);
    });
  });
});