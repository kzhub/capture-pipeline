#!/usr/bin/env node

import express from 'express';
import { spawn } from 'child_process';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Get config file path
const CONFIG_DIR = path.join(process.env.HOME, '.photo-backup-config');
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

// Upload from local directory
app.post('/api/upload', async (req, res) => {
  const { sourcePath, startDate, endDate, dryRun = false } = req.body;
  
  if (!sourcePath) {
    return res.status(400).json({ error: 'Source path is required' });
  }
  
  const scriptPath = path.join(__dirname, 'backup-photos.sh');
  const args = ['--source', sourcePath];
  
  if (startDate) {
    args.push('--start', startDate);
  }
  
  if (endDate) {
    args.push('--end', endDate);
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
        message: 'Upload completed successfully'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: error || 'Upload failed',
        output 
      });
    }
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});