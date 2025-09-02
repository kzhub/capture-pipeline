import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SettingsTab } from '../SettingsTab';
import { vi } from 'vitest';

// Mock the API
vi.mock('../../api', () => ({
  api: {
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
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('SettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders settings form with all fields', async () => {
    render(
      <TestWrapper>
        <SettingsTab />
      </TestWrapper>
    );

    // Wait for settings to load (check for a specific element after loading)
    await waitFor(() => {
      expect(screen.getByDisplayValue('test-bucket')).toBeInTheDocument();
    });

    expect(screen.getByText('設定')).toBeInTheDocument();
    expect(screen.getByText('AWS接続状態')).toBeInTheDocument();
    expect(screen.getByText('S3設定')).toBeInTheDocument();
    expect(screen.getByText('ローカル設定')).toBeInTheDocument();
    // Check that the form fields are rendered by checking their values
    expect(screen.getByDisplayValue('test-bucket')).toBeInTheDocument();
    expect(screen.getByDisplayValue('/Users/test/Desktop')).toBeInTheDocument();
  });

  test('displays AWS connection status', async () => {
    render(
      <TestWrapper>
        <SettingsTab />
      </TestWrapper>
    );

    // Wait for AWS status to load
    await waitFor(() => {
      expect(screen.getByText('設定済み')).toBeInTheDocument();
    });

    expect(screen.getByText('arn:aws:iam::123456789:user/test')).toBeInTheDocument();
  });

  test('loads existing configuration', async () => {
    render(
      <TestWrapper>
        <SettingsTab />
      </TestWrapper>
    );

    await waitFor(() => {
      const bucketField = screen.getByDisplayValue('test-bucket');
      expect(bucketField).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('/Users/test/Desktop')).toBeInTheDocument();
  });

  test('shows Deep Archive warning when selected', async () => {
    render(
      <TestWrapper>
        <SettingsTab />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('設定')).toBeInTheDocument();
    });

    // Click save button (Deep Archive is already selected by default)
    const saveButton = screen.getByRole('button', { name: /設定を保存/ });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Deep Archive設定について')).toBeInTheDocument();
    });

    expect(screen.getByText(/最低12時間の保存期間制約があります/)).toBeInTheDocument();
  });

  test('saves configuration after confirming Deep Archive warning', async () => {
    const { api } = await import('../../api');
    
    render(
      <TestWrapper>
        <SettingsTab />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('設定')).toBeInTheDocument();
    });

    // Click save button
    const saveButton = screen.getByRole('button', { name: /設定を保存/ });
    fireEvent.click(saveButton);

    // Confirm in warning dialog
    const confirmButton = await screen.findByRole('button', { name: /理解して保存/ });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(api.saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          S3_BUCKET: 'test-bucket',
          S3_STORAGE_CLASS: 'DEEP_ARCHIVE',
        })
      );
    });
  });

  test('updates form fields', async () => {
    render(
      <TestWrapper>
        <SettingsTab />
      </TestWrapper>
    );

    // Wait for form to load completely
    await waitFor(() => {
      expect(screen.getByDisplayValue('test-bucket')).toBeInTheDocument();
    });

    const bucketField = screen.getByDisplayValue('test-bucket');
    
    // Clear the field first, then type new value
    fireEvent.change(bucketField, { target: { value: '' } });
    fireEvent.change(bucketField, { target: { value: 'new-bucket' } });

    // Wait for the change to be reflected
    await waitFor(() => {
      expect(screen.getByDisplayValue('new-bucket')).toBeInTheDocument();
    });
  });
});