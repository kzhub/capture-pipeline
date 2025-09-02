import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { useSettings } from '../hooks/useSettings';

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

// Mock the API
vi.mock('../api', () => ({
  api: {
    getConfig: vi.fn(),
    checkAWS: vi.fn(),
    saveConfig: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    // @ts-ignore
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage.getItem.mockReturnValue(null);
  });

  test('should initialize with default values', () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(),
    });

    expect(result.current.config).toEqual({
      S3_BUCKET: '',
      LOCAL_IMPORT_BASE: '',
      S3_STORAGE_CLASS: 'DEEP_ARCHIVE',
      S3_PREFIX_RAW: 'raw',
      S3_PREFIX_JPG: 'jpg',
      AWS_REGION: 'ap-northeast-1',
    });
    expect(result.current.showWarning).toBe(false);
    expect(result.current.isInitialLoad).toBe(true);
  });

  test('should initialize with cached config', () => {
    const cachedConfig = {
      S3_BUCKET: 'cached-bucket',
      LOCAL_IMPORT_BASE: '/cached/path',
      S3_STORAGE_CLASS: 'STANDARD',
      S3_PREFIX_RAW: 'cached-raw',
      S3_PREFIX_JPG: 'cached-jpg',
      AWS_REGION: 'us-east-1',
    };

    mockSessionStorage.getItem.mockImplementation((key: string) => {
      if (key === 'photo-backup-config-cache') {
        return JSON.stringify({
          value: cachedConfig,
          timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago
        });
      }
      return null;
    });

    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(),
    });

    expect(result.current.config).toEqual(cachedConfig);
    expect(result.current.isInitialLoad).toBe(false);
  });

  test('should ignore expired cache', () => {
    const expiredConfig = {
      S3_BUCKET: 'expired-bucket',
    };

    mockSessionStorage.getItem.mockImplementation((key: string) => {
      if (key === 'photo-backup-config-cache') {
        return JSON.stringify({
          value: expiredConfig,
          timestamp: Date.now() - 15 * 60 * 1000, // 15 minutes ago (expired)
        });
      }
      return null;
    });

    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(),
    });

    expect(result.current.config.S3_BUCKET).toBe('');
    expect(result.current.isInitialLoad).toBe(true);
  });

  test('should handle config change', () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleConfigChange('S3_BUCKET', 'new-bucket');
    });

    expect(result.current.config.S3_BUCKET).toBe('new-bucket');
  });

  test('should show warning for Deep Archive', () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleConfigChange('S3_STORAGE_CLASS', 'DEEP_ARCHIVE');
    });

    act(() => {
      result.current.handleSave();
    });

    expect(result.current.showWarning).toBe(true);
  });

  test('should save config without warning for non-Deep Archive', async () => {
    const { api } = await import('../api');
    const mockSaveConfig = api.saveConfig as any;
    mockSaveConfig.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleConfigChange('S3_STORAGE_CLASS', 'STANDARD');
    });

    act(() => {
      result.current.handleSave();
    });

    expect(result.current.showWarning).toBe(false);
    expect(mockSaveConfig).toHaveBeenCalled();
  });

  test('should confirm save after warning', async () => {
    const { api } = await import('../api');
    const mockSaveConfig = api.saveConfig as any;
    mockSaveConfig.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(),
    });

    // First trigger warning
    act(() => {
      result.current.handleSave(); // Default is DEEP_ARCHIVE
    });

    expect(result.current.showWarning).toBe(true);

    // Then confirm save
    act(() => {
      result.current.handleConfirmSave();
    });

    expect(result.current.showWarning).toBe(false);
    expect(mockSaveConfig).toHaveBeenCalled();
  });

  test('should provide STORAGE_CLASSES', () => {
    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(),
    });

    expect(result.current.STORAGE_CLASSES).toEqual([
      { value: 'STANDARD', label: 'Standard（標準）', cost: '高' },
      { value: 'STANDARD_IA', label: 'Standard-IA（低頻度アクセス）', cost: '中' },
      { value: 'GLACIER', label: 'Glacier（アーカイブ）', cost: '低' },
      { value: 'DEEP_ARCHIVE', label: 'Deep Archive（長期アーカイブ）', cost: '最低' },
    ]);
  });

  test('should handle session storage errors gracefully', () => {
    mockSessionStorage.getItem.mockImplementation(() => {
      throw new Error('Storage error');
    });

    const { result } = renderHook(() => useSettings(), {
      wrapper: createWrapper(),
    });

    // Should still initialize with defaults
    expect(result.current.config.S3_BUCKET).toBe('');
    expect(result.current.isInitialLoad).toBe(true);
  });
});