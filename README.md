# Photo S3 Backup Tool

写真・動画をS3にバックアップするツール。SDカード/カメラから直接取り込み、自動的にS3へアップロードします。

## 📌 重要な機能：日付指定取り込み

**SDカードから特定の日付のファイルのみを取り込みます**

```bash
# 今日撮影した写真のみ取り込み（デフォルト）
./backup-photos.sh --import /Volumes/EOS_DIGITAL

# 特定日に撮影した写真のみ取り込み
./backup-photos.sh --import /Volumes/EOS_DIGITAL --import-date 2024-12-25
```

この機能により：
- 大量のファイルがあるSDカードから**必要な日付分だけ**を取り込み
- 取り込み済みファイルと新規ファイルの混在を防ぐ
- 日付ごとに整理された状態で保存

## 特徴

- **日付指定での選択的取り込み**（最重要機能）
- SDカード/カメラからの直接取り込み
- Fujifilm RAWファイル(.RAF)対応
- ファイルタイプ別の階層管理（raw/jpg）
- 年-月フォルダへの自動振り分け
- 重複アップロード防止（.uploadedファイルで管理）
- 初回設定で保存先とS3バケットを対話的に設定

## ワークフロー

1. **日付を指定してSDカードから取り込み** → 指定日のファイルのみ
2. **ローカルに保存** → 日付フォルダ（例: ~/Desktop/20241225/）
3. **自動的にS3へアップロード** → ファイルタイプ別に整理

## フォルダ構造

### ローカル（取り込み時）
```
~/Desktop/（初回設定で指定）
└── 20241225/         # 日付ごとのフォルダ
    ├── IMG_001.RAF   # RAWファイル
    └── IMG_001.JPG   # JPEGファイル
```

### S3
```
s3://your-bucket/
├── raw/           # RAWファイル（DNG, RAF, CR2, NEF等）
│   ├── 2024-01/
│   └── 2024-12/
└── jpg/           # JPEGファイル（JPG, JPEG, HEIC）
    ├── 2024-01/
    └── 2024-12/
```

## セットアップ

### 1. AWS CLIをインストール
```bash
brew install awscli
```

### 2. AWS認証設定
```bash
aws configure
```

### 3. 初回設定（必須）
```bash
./backup-photos.sh --config
```

初回実行時に以下を対話的に設定：
- **S3バケット名**: 写真を保存するS3バケット
- **ローカル保存先**: SDカードから取り込む際の保存先（デフォルト: ~/Desktop）

### 4. （オプション）環境変数でバケット名を上書き
```bash
export PHOTO_BACKUP_BUCKET=your-s3-bucket-name
```

## 使い方

### SDカードから取り込み＆S3アップロード

```bash
# 今日撮影した写真を取り込み
./backup-photos.sh --import /Volumes/EOS_DIGITAL

# 特定日の写真を取り込み
./backup-photos.sh --import /Volumes/EOS_DIGITAL --import-date 2024-12-25

# ドライラン（確認のみ）
./backup-photos.sh --import /Volumes/EOS_DIGITAL --dry-run
```

### ローカルフォルダをバックアップ

```bash
# フォルダ全体をバックアップ
./backup-photos.sh --source ~/Pictures

# 日付範囲指定
./backup-photos.sh --source ~/Pictures --start 2024-01-01 --end 2024-12-31

# 詳細ログ表示
./backup-photos.sh --source ~/Pictures --verbose
```

## 設定ファイル

`~/.photo-backup-config/config`に保存されます：

| 設定項目 | 説明 | デフォルト値 |
|---------|------|------------|
| `S3_BUCKET` | S3バケット名（環境変数で上書き可能） | 初回設定時に入力 |
| `LOCAL_IMPORT_BASE` | SDカードから取り込む際のローカル保存先 | ~/Desktop（初回設定時に指定） |
| `RAW_EXTENSIONS` | RAWファイルの拡張子 | dng,raf,cr2,cr3,nef,arw,orf,rw2 |
| `JPG_EXTENSIONS` | JPEGファイルの拡張子 | jpg,jpeg,heic,heif |
| `S3_PREFIX_RAW` | S3のRAWファイル用プレフィックス | raw |
| `S3_PREFIX_JPG` | S3のJPEGファイル用プレフィックス | jpg |

設定を変更する場合：
```bash
./backup-photos.sh --config
```

## 対応ファイル形式

- **RAW**: dng, raf (Fujifilm), cr2, cr3, nef, arw, orf, rw2
- **JPEG**: jpg, jpeg, heic, heif

## 重複管理

各ディレクトリの`.uploaded`ファイルにアップロード済みファイルのハッシュ値を記録し、重複アップロードを防ぎます。