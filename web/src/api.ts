import axios from 'axios';

const API_BASE = 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 60000, // 60 seconds for long operations
});

export const api = {
  // Configuration
  async getConfig() {
    const response = await apiClient.get('/config');
    return response.data;
  },

  async saveConfig(config: any) {
    const response = await apiClient.post('/config', config);
    return response.data;
  },

  // AWS
  async checkAWS() {
    const response = await apiClient.get('/check-aws');
    return response.data;
  },

  // Volumes
  async getVolumes() {
    const response = await apiClient.get('/volumes');
    return response.data;
  },

  // Import
  async importPhotos(sourcePath: string, importDate: string, dryRun = false) {
    const response = await apiClient.post('/import', {
      sourcePath,
      importDate,
      dryRun,
    });
    return response.data;
  },

  // Upload
  async uploadPhotos(sourcePath: string, startDate?: string, endDate?: string, dryRun = false) {
    const response = await apiClient.post('/upload', {
      sourcePath,
      startDate,
      endDate,
      dryRun,
    });
    return response.data;
  },

  // Get active uploads
  async getUploads() {
    const response = await apiClient.get('/uploads');
    return response.data;
  },

  // Get specific upload status
  async getUpload(uploadId: string) {
    const response = await apiClient.get(`/uploads/${uploadId}`);
    return response.data;
  },
};