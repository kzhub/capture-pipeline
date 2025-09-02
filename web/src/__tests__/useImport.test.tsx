import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import dayjs from 'dayjs';
import { useImport } from '../hooks/useImport';

// Mock the API
vi.mock('../api', () => ({
  api: {
    importPhotos: vi.fn(),
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

describe('useImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should initialize with default values', () => {
    const { result } = renderHook(() => useImport(), {
      wrapper: createWrapper(),
    });

    expect(result.current.selectedPath).toBe('');
    expect(result.current.selectedDate).toBeTruthy();
    expect(result.current.dryRun).toBe(true);
    expect(result.current.fileInputRef.current).toBe(null);
    expect(result.current.isFormValid).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  test('should update selectedDate', () => {
    const { result } = renderHook(() => useImport(), {
      wrapper: createWrapper(),
    });

    const newDate = dayjs('2023-12-01');

    act(() => {
      result.current.setSelectedDate(newDate);
    });

    expect(result.current.selectedDate?.format('YYYY-MM-DD')).toBe('2023-12-01');
  });

  test('should update dryRun', () => {
    const { result } = renderHook(() => useImport(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setDryRun(false);
    });

    expect(result.current.dryRun).toBe(false);
  });

  test('should handle file change', () => {
    const { result } = renderHook(() => useImport(), {
      wrapper: createWrapper(),
    });

    const mockFile = {
      webkitRelativePath: 'TestDirectory/photo.jpg',
    } as File;

    const mockEvent = {
      target: {
        files: [mockFile],
      },
    } as React.ChangeEvent<HTMLInputElement>;

    act(() => {
      result.current.handleFileChange(mockEvent);
    });

    expect(result.current.selectedPath).toBe('TestDirectory');
  });

  test('should validate form correctly', () => {
    const { result } = renderHook(() => useImport(), {
      wrapper: createWrapper(),
    });

    // Initially invalid
    expect(result.current.isFormValid).toBe(false);

    // Set path but no date
    act(() => {
      const mockFile = {
        webkitRelativePath: 'TestDirectory/photo.jpg',
      } as File;

      const mockEvent = {
        target: {
          files: [mockFile],
        },
      } as React.ChangeEvent<HTMLInputElement>;

      result.current.handleFileChange(mockEvent);
      result.current.setSelectedDate(null);
    });

    expect(result.current.isFormValid).toBe(false);

    // Set both path and date
    act(() => {
      result.current.setSelectedDate(dayjs());
    });

    expect(result.current.isFormValid).toBe(true);
  });

  test('should handle import action', async () => {
    const { api } = await import('../api');
    const mockImportPhotos = api.importPhotos as any;
    mockImportPhotos.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useImport(), {
      wrapper: createWrapper(),
    });

    // Setup form
    act(() => {
      const mockFile = {
        webkitRelativePath: 'TestDirectory/photo.jpg',
      } as File;

      const mockEvent = {
        target: {
          files: [mockFile],
        },
      } as React.ChangeEvent<HTMLInputElement>;

      result.current.handleFileChange(mockEvent);
      result.current.setSelectedDate(dayjs('2023-12-01'));
      result.current.setDryRun(false);
    });

    // Execute import
    act(() => {
      result.current.handleImport();
    });

    expect(mockImportPhotos).toHaveBeenCalledWith(
      'TestDirectory',
      '2023-12-01',
      false
    );
  });

  test('should not import when form is invalid', () => {
    const { result } = renderHook(() => useImport(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleImport();
    });

    // Should not call API when form is invalid
    expect(result.current.importMutation.isPending).toBe(false);
  });
});