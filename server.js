#!/usr/bin/env node

import express from 'express';
import { spawn } from 'child_process';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const HOME_DIR = process.env.HOME || process.env.USERPROFILE;

// Active upload processes
const activeUploads = new Map();
const PROGRESS_DIR = path.join(HOME_DIR, '.photo-backup-progress');

// Initialize progress directory
async function initProgressDir() {
  try {
    await fs.mkdir(PROGRESS_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create progress directory:', error);
  }
}

// Save upload progress to file
async function saveUploadProgress(uploadId, data) {
  try {
    const progressFile = path.join(PROGRESS_DIR, `${uploadId}.json`);
    await fs.writeFile(progressFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to save progress:', error);
  }
}

// Load upload progress from file
async function loadUploadProgress(uploadId) {
  try {
    const progressFile = path.join(PROGRESS_DIR, `${uploadId}.json`);
    const content = await fs.readFile(progressFile, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

// Load all active uploads on startup
async function loadActiveUploads() {
  try {
    const files = await fs.readdir(PROGRESS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const uploadId = file.replace('.json', '');
        const data = await loadUploadProgress(uploadId);
        if (data && data.status === 'running') {
          // Mark as interrupted if server was restarted during upload
          data.status = 'interrupted';
          activeUploads.set(uploadId, data);
          await saveUploadProgress(uploadId, data);
        }
      }
    }
  } catch (error) {
    console.error('Failed to load active uploads:', error);
  }
}

app.use(cors());
app.use(express.json());

// Get config file path
const CONFIG_DIR = path.join(HOME_DIR, '.photo-backup-config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config');

// Load configuration
async function loadConfig() {
  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = {};
    content.split('\n').forEach(line => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split('=');
        if (key && value) {
          config[key] = value.replace(/"/g, '');
        }
      }
    });
    return config;
  } catch (error) {
    return null;
  }
}

// Save configuration
async function saveConfig(config) {
  const content = `# S3バケット設定
S3_BUCKET="${config.S3_BUCKET}"
S3_PREFIX_RAW="${config.S3_PREFIX_RAW || 'raw'}"
S3_PREFIX_JPG="${config.S3_PREFIX_JPG || 'jpg'}"

# ファイル拡張子（カンマ区切り）
RAW_EXTENSIONS="${config.RAW_EXTENSIONS || 'dng,raf,cr2,cr3,nef,arw,orf,rw2'}"
JPG_EXTENSIONS="${config.JPG_EXTENSIONS || 'jpg,jpeg,heic,heif'}"

# 除外パターン（カンマ区切り）
EXCLUDE_PATTERNS="${config.EXCLUDE_PATTERNS || '.DS_Store,Thumbs.db,.thumbnails'}"

# ローカル保存先（取り込み時）
LOCAL_IMPORT_BASE="${config.LOCAL_IMPORT_BASE}"

# AWS設定
AWS_PROFILE="${config.AWS_PROFILE || 'default'}"
AWS_REGION="${config.AWS_REGION || 'ap-northeast-1'}"

# S3ストレージクラス
S3_STORAGE_CLASS="${config.S3_STORAGE_CLASS || 'DEEP_ARCHIVE'}"`;

  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_FILE, content);
}

// Get configuration
app.get('/api/config', async (req, res) => {
  const config = await loadConfig();
  if (!config) {
    return res.json({ 
      configured: false,
      message: 'Configuration not found. Please run initial setup.'
    });
  }
  
  // Don't send sensitive data to frontend
  res.json({
    configured: true,
    S3_BUCKET: config.S3_BUCKET || '',
    LOCAL_IMPORT_BASE: config.LOCAL_IMPORT_BASE || '',
    S3_STORAGE_CLASS: config.S3_STORAGE_CLASS || 'DEEP_ARCHIVE',
    S3_PREFIX_RAW: config.S3_PREFIX_RAW || 'raw',
    S3_PREFIX_JPG: config.S3_PREFIX_JPG || 'jpg',
    AWS_REGION: config.AWS_REGION || 'ap-northeast-1'
  });
});

// Update configuration
app.post('/api/config', async (req, res) => {
  try {
    const currentConfig = await loadConfig() || {};
    const updatedConfig = { ...currentConfig, ...req.body };
    await saveConfig(updatedConfig);
    res.json({ success: true, message: 'Configuration saved' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List volumes (for directory picker)
app.get('/api/volumes', async (req, res) => {
  try {
    const volumes = [];
    
    // List /Volumes on macOS
    if (process.platform === 'darwin') {
      const volumesPath = '/Volumes';
      const dirs = await fs.readdir(volumesPath);
      for (const dir of dirs) {
        try {
          const stat = await fs.stat(path.join(volumesPath, dir));
          if (stat.isDirectory()) {
            volumes.push({
              name: dir,
              path: path.join(volumesPath, dir),
              type: 'volume'
            });
          }
        } catch (e) {
          // Skip inaccessible volumes
        }
      }
    }
    
    // Add common paths
    volumes.push(
      { name: 'Desktop', path: path.join(process.env.HOME, 'Desktop'), type: 'folder' },
      { name: 'Pictures', path: path.join(process.env.HOME, 'Pictures'), type: 'folder' },
      { name: 'Downloads', path: path.join(process.env.HOME, 'Downloads'), type: 'folder' }
    );
    
    res.json(volumes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import photos
app.post('/api/import', async (req, res) => {
  const { sourcePath, importDate, dryRun = false } = req.body;
  
  if (!sourcePath) {
    return res.status(400).json({ error: 'Source path is required' });
  }
  
  const scriptPath = path.join(__dirname, 'backup-photos.sh');
  const args = ['--import', sourcePath];
  
  if (importDate) {
    args.push('--import-date', importDate);
  }
  
  if (dryRun) {
    args.push('--dry-run');
  }
  
  const process = spawn(scriptPath, args);
  
  let output = '';
  let error = '';
  
  process.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  process.stderr.on('data', (data) => {
    error += data.toString();
  });
  
  process.on('close', (code) => {
    if (code === 0) {
      res.json({ 
        success: true, 
        output,
        message: 'Import completed successfully'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: error || 'Import failed',
        output 
      });
    }
  });
});

// Get active uploads
app.get('/api/uploads', async (req, res) => {
  try {
    const uploads = Array.from(activeUploads.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
    res.json(uploads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific upload status
app.get('/api/uploads/:id', async (req, res) => {
  const { id } = req.params;
  const upload = activeUploads.get(id);
  
  if (!upload) {
    return res.status(404).json({ error: 'Upload not found' });
  }
  
  res.json({ id, ...upload });
});

// Upload from local directory
app.post('/api/upload', async (req, res) => {
  const { sourcePath, startDate, endDate, dryRun = false } = req.body;
  
  if (!sourcePath) {
    return res.status(400).json({ error: 'Source path is required' });
  }
  
  // Generate unique upload ID
  const uploadId = uuidv4();
  
  // ディレクトリ名からフルパスを解決
  let fullPath = sourcePath;
  if (!path.isAbsolute(sourcePath)) {
    // 一般的な場所を検索
    const commonPaths = [
      path.join(HOME_DIR, 'Desktop', sourcePath),
      path.join(HOME_DIR, 'Pictures', sourcePath),
      path.join(HOME_DIR, 'Downloads', sourcePath),
      path.join('/Volumes', sourcePath),
      path.join(HOME_DIR, sourcePath)
    ];
    
    for (const testPath of commonPaths) {
      try {
        const stat = await fs.stat(testPath);
        if (stat.isDirectory()) {
          fullPath = testPath;
          break;
        }
      } catch (e) {
        // 続行
      }
    }
  }
  
  // Initialize upload tracking
  const uploadData = {
    status: 'running',
    sourcePath: fullPath,
    startDate,
    endDate,
    dryRun,
    startTime: new Date().toISOString(),
    output: '',
    error: '',
    currentFile: '',
    progress: { total: 0, completed: 0, skipped: 0 }
  };
  
  activeUploads.set(uploadId, uploadData);
  await saveUploadProgress(uploadId, uploadData);
  
  // Return upload ID immediately
  res.json({ 
    uploadId,
    message: 'Upload started',
    status: 'running'
  });
  
  const scriptPath = path.join(__dirname, 'backup-photos.sh');
  const args = ['--source', fullPath];
  
  if (startDate) {
    args.push('--start', startDate);
  }
  
  if (endDate) {
    args.push('--end', endDate);
  }
  
  if (dryRun) {
    args.push('--dry-run');
  }
  
  const childProcess = spawn(scriptPath, args);
  
  childProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    uploadData.output += chunk;
    
    // Parse progress from output if possible
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.includes('アップロード中:') || line.includes('[DRY RUN]')) {
        const match = line.match(/([^/\\]+\.(?:jpg|jpeg|png|dng|raf|cr2|cr3|nef|arw|orf|rw2))/i);
        if (match) {
          uploadData.currentFile = match[1];
        }
      }
      if (line.includes('総ファイル数:')) {
        const match = line.match(/総ファイル数:\s*(\d+)/);
        if (match) uploadData.progress.total = parseInt(match[1]);
      }
      if (line.includes('アップロード:')) {
        const match = line.match(/アップロード:\s*(\d+)/);
        if (match) uploadData.progress.completed = parseInt(match[1]);
      }
      if (line.includes('スキップ:')) {
        const match = line.match(/スキップ:\s*(\d+)/);
        if (match) uploadData.progress.skipped = parseInt(match[1]);
      }
    }
    
    // Save progress periodically
    saveUploadProgress(uploadId, uploadData);
  });
  
  childProcess.stderr.on('data', (data) => {
    uploadData.error += data.toString();
  });
  
  childProcess.on('close', async (code) => {
    uploadData.status = code === 0 ? 'completed' : 'failed';
    uploadData.endTime = new Date().toISOString();
    uploadData.exitCode = code;
    
    // Save final state
    await saveUploadProgress(uploadId, uploadData);
    
    // Keep upload data for 1 hour after completion
    setTimeout(async () => {
      activeUploads.delete(uploadId);
      try {
        const progressFile = path.join(PROGRESS_DIR, `${uploadId}.json`);
        await fs.unlink(progressFile);
      } catch (error) {
        console.error('Failed to delete progress file:', error);
      }
    }, 60 * 60 * 1000);
  });
});

// Check AWS credentials
app.get('/api/check-aws', async (req, res) => {
  const process = spawn('aws', ['sts', 'get-caller-identity']);
  
  let output = '';
  let error = '';
  
  process.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  process.stderr.on('data', (data) => {
    error += data.toString();
  });
  
  process.on('close', (code) => {
    if (code === 0) {
      try {
        const identity = JSON.parse(output);
        res.json({ 
          configured: true, 
          identity 
        });
      } catch (e) {
        res.json({ 
          configured: true,
          message: 'AWS CLI is configured'
        });
      }
    } else {
      res.json({ 
        configured: false,
        message: 'AWS CLI is not configured. Please run: aws configure'
      });
    }
  });
});

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await initProgressDir();
  await loadActiveUploads();
});