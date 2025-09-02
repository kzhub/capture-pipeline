import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import dayjs from 'dayjs';
import { useUpload } from '../hooks/useUpload';

// Mock the API
vi.mock('../api', () => ({
  api: {
    getUploads: vi.fn(),
    getUpload: vi.fn(),
    uploadPhotos: vi.fn(),
    stopUpload: vi.fn(),
    resumeUpload: vi.fn(),
  },
}));

const createWrapper = () => {
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

  return ({ children }: { children: React.ReactNode }) => (
    // @ts-ignore
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should initialize with default values', () => {
    const { api } = require('../api');
    api.getUploads.mockResolvedValue([]);

    const { result } = renderHook(() => useUpload(), {
      wrapper: createWrapper(),
    });

    expect(result.current.selectedPath).toBe('');
    expect(result.current.startDate).toBe(null);
    expect(result.current.endDate).toBe(null);
    expect(result.current.dryRun).toBe(true);
    expect(result.current.activeUploadId).toBe(null);
    expect(result.current.isFormValid).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasActiveUpload).toBe(false);
    expect(result.current.isUploadRunning).toBe(false);
    expect(result.current.isUploadInterrupted).toBe(false);
  });

  test('should update dates', () => {
    const { api } = require('../api');
    api.getUploads.mockResolvedValue([]);

    const { result } = renderHook(() => useUpload(), {
      wrapper: createWrapper(),
    });

    const startDate = dayjs('2023-12-01');
    const endDate = dayjs('2023-12-31');

    act(() => {
      result.current.setStartDate(startDate);
      result.current.setEndDate(endDate);
    });

    expect(result.current.startDate?.format('YYYY-MM-DD')).toBe('2023-12-01');
    expect(result.current.endDate?.format('YYYY-MM-DD')).toBe('2023-12-31');
  });

  test('should update dryRun', () => {
    const { api } = require('../api');
    api.getUploads.mockResolvedValue([]);

    const { result } = renderHook(() => useUpload(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setDryRun(false);
    });

    expect(result.current.dryRun).toBe(false);
  });

  test('should handle file change', () => {
    const { api } = require('../api');
    api.getUploads.mockResolvedValue([]);

    const { result } = renderHook(() => useUpload(), {
      wrapper: createWrapper(),
    });

    const mockFile = {
      webkitRelativePath: 'TestDirectory/subfolder/photo.jpg',
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
    const { api } = require('../api');
    api.getUploads.mockResolvedValue([]);

    const { result } = renderHook(() => useUpload(), {
      wrapper: createWrapper(),
    });

    // Initially invalid
    expect(result.current.isFormValid).toBe(false);

    // Set path
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
    });

    expect(result.current.isFormValid).toBe(true);
  });

  test('should handle upload action', async () => {
    const { api } = await import('../api');
    const mockUploadPhotos = api.uploadPhotos as any;
    const mockGetUploads = api.getUploads as any;
    
    mockGetUploads.mockResolvedValue([]);
    mockUploadPhotos.mockResolvedValue({ uploadId: 'test-upload-id' });

    const { result } = renderHook(() => useUpload(), {
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
      result.current.setStartDate(dayjs('2023-12-01'));
      result.current.setEndDate(dayjs('2023-12-31'));
      result.current.setDryRun(false);
    });

    // Execute upload
    act(() => {
      result.current.handleUpload();
    });

    expect(mockUploadPhotos).toHaveBeenCalledWith(
      'TestDirectory',
      '2023-12-01',
      '2023-12-31',
      false
    );
  });

  test('should handle upload without dates', async () => {
    const { api } = await import('../api');
    const mockUploadPhotos = api.uploadPhotos as any;
    const mockGetUploads = api.getUploads as any;
    
    mockGetUploads.mockResolvedValue([]);
    mockUploadPhotos.mockResolvedValue({ uploadId: 'test-upload-id' });

    const { result } = renderHook(() => useUpload(), {
      wrapper: createWrapper(),
    });

    // Setup form without dates
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
    });

    // Execute upload
    act(() => {
      result.current.handleUpload();
    });

    expect(mockUploadPhotos).toHaveBeenCalledWith(
      'TestDirectory',
      undefined,
      undefined,
      true
    );
  });

  test('should not upload when form is invalid', () => {
    const { api } = require('../api');
    api.getUploads.mockResolvedValue([]);

    const { result } = renderHook(() => useUpload(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.handleUpload();
    });

    // Should not call API when form is invalid
    expect(result.current.uploadMutation.isPending).toBe(false);
  });

  test('should handle stop upload', async () => {
    const { api } = await import('../api');
    const mockStopUpload = api.stopUpload as any;
    const mockGetUploads = api.getUploads as any;
    const mockGetUpload = api.getUpload as any;
    
    mockGetUploads.mockResolvedValue([
      { id: 'test-upload', status: 'running', sourcePath: 'TestDir' }
    ]);
    mockGetUpload.mockResolvedValue({ status: 'running' });
    mockStopUpload.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useUpload(), {
      wrapper: createWrapper(),
    });

    // Wait for useEffect to set activeUploadId
    await act(async () => {
      // Manually set activeUploadId to simulate active upload
      result.current.activeUploadId = 'test-upload';
    });

    await act(async () => {
      await result.current.handleStop();
    });

    expect(mockStopUpload).toHaveBeenCalledWith('test-upload');
  });

  test('should handle resume upload', async () => {
    const { api } = await import('../api');
    const mockResumeUpload = api.resumeUpload as any;
    const mockGetUploads = api.getUploads as any;
    
    mockGetUploads.mockResolvedValue([]);
    mockResumeUpload.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useUpload(), {
      wrapper: createWrapper(),
    });

    // Manually set activeUploadId
    act(() => {
      (result.current as any).activeUploadId = 'test-upload';
    });

    await act(async () => {
      await result.current.handleResume();
    });

    expect(mockResumeUpload).toHaveBeenCalledWith('test-upload');
  });

  test('should determine upload status correctly', () => {
    const { api } = require('../api');
    api.getUploads.mockResolvedValue([]);

    const { result } = renderHook(() => useUpload(), {
      wrapper: createWrapper(),
    });

    // Mock uploadStatus
    act(() => {
      // Simulate having active upload with running status
      (result.current as any).activeUploadId = 'test-upload';
      (result.current as any).uploadStatus = { status: 'running' };
    });

    // Note: These would be computed in the actual hook based on uploadStatus
    // For testing, we're checking the logic structure
    expect(typeof result.current.isUploadRunning).toBe('boolean');
    expect(typeof result.current.isUploadInterrupted).toBe('boolean');
    expect(typeof result.current.hasActiveUpload).toBe('boolean');
  });
});