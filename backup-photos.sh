#!/bin/bash

set -euo pipefail

# デフォルト設定
CONFIG_DIR="$HOME/.photo-backup-config"
CONFIG_FILE="$CONFIG_DIR/config"
SOURCE_DIR=""
START_DATE=""
END_DATE=""
DRY_RUN=false
VERBOSE=false
IMPORT_MODE=false
SD_PATH=""
IMPORT_DATE=""

# 色付き出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ヘルプメッセージ
usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

写真・動画をS3にバックアップするツール

OPTIONS:
    -s, --source DIR        バックアップ元ディレクトリ
    -i, --import PATH       SDカード/カメラから取り込み (例: /Volumes/EOS_DIGITAL)
    --import-date DATE      取り込み対象日 (YYYY-MM-DD, デフォルト: 今日)
    --start DATE           開始日 (YYYY-MM-DD)
    --end DATE             終了日 (YYYY-MM-DD)
    -d, --dry-run          実行内容の確認のみ（実際にはアップロードしない）
    -v, --verbose          詳細ログを表示
    -c, --config           設定を表示/編集
    -h, --help             このヘルプを表示

例:
    # SDカードから取り込み＆S3アップロード
    $(basename "$0") --import /Volumes/EOS_DIGITAL
    
    # 特定日の写真を取り込み
    $(basename "$0") --import /Volumes/EOS_DIGITAL --import-date 2024-12-25
    
    # ローカルフォルダをバックアップ
    $(basename "$0") --source ~/Pictures --start 2024-01-01 --end 2024-12-31
    
    # ドライラン
    $(basename "$0") --source ~/Pictures --dry-run

EOF
    exit 0
}

# エラーハンドリング
error() {
    echo -e "${RED}エラー: $1${NC}" >&2
    exit 1
}

# 成功メッセージ
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 警告メッセージ
warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 情報メッセージ
info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# 設定ファイルの初期化
init_config() {
    if [ ! -d "$CONFIG_DIR" ]; then
        mkdir -p "$CONFIG_DIR"
    fi
}

# 設定の読み込み
load_config() {
    init_config
    
    # 設定ファイルが存在しない場合は初回設定を促す
    if [ ! -f "$CONFIG_FILE" ] || [ ! -s "$CONFIG_FILE" ]; then
        warning "設定ファイルが見つかりません"
        echo "初回設定を実行してください:"
        echo "  $0 --config"
        exit 1
    fi
    
    set +u  # 一時的にundefined変数チェックを無効化
    source "$CONFIG_FILE"
    set -u  # 再度有効化
    
    # 環境変数からS3バケットを読み込み（環境変数が優先）
    if [ -n "${PHOTO_BACKUP_BUCKET:-}" ]; then
        S3_BUCKET="$PHOTO_BACKUP_BUCKET"
    fi
    
    if [ -z "${S3_BUCKET:-}" ]; then
        error "S3バケットが設定されていません。--config で設定してください"
    fi
}

# 設定の編集
edit_config() {
    init_config
    
    # 初回設定の場合は対話的に設定
    if [ ! -f "$CONFIG_FILE" ] || [ ! -s "$CONFIG_FILE" ]; then
        info "初回設定を開始します"
        echo ""
        
        # S3バケット名
        read -p "S3バケット名を入力してください: " bucket_name
        while [ -z "$bucket_name" ]; do
            error "バケット名は必須です"
            read -p "S3バケット名を入力してください: " bucket_name
        done
        
        # ローカル保存先
        echo ""
        echo "SDカードから取り込む際のローカル保存先を入力してください"
        echo "例: $HOME/Desktop, $HOME/Pictures/Photos"
        read -p "保存先パス (デフォルト: $HOME/Desktop): " import_path
        if [ -z "$import_path" ]; then
            import_path="$HOME/Desktop"
        fi
        
        # 設定ファイルを生成
        cat > "$CONFIG_FILE" << EOF
# S3バケット設定
S3_BUCKET="$bucket_name"
S3_PREFIX_RAW="raw"
S3_PREFIX_JPG="jpg"

# ファイル拡張子（カンマ区切り）
RAW_EXTENSIONS="dng,raf,cr2,cr3,nef,arw,orf,rw2"
JPG_EXTENSIONS="jpg,jpeg,heic,heif"

# 除外パターン（カンマ区切り）
EXCLUDE_PATTERNS=".DS_Store,Thumbs.db,.thumbnails"

# ローカル保存先（取り込み時）
LOCAL_IMPORT_BASE="$import_path"

# AWS設定
AWS_PROFILE="default"
AWS_REGION="ap-northeast-1"
EOF
        
        success "設定を保存しました: $CONFIG_FILE"
        echo ""
        echo "設定内容:"
        echo "  S3バケット: $bucket_name"
        echo "  ローカル保存先: $import_path"
        echo ""
    else
        # 既存の設定がある場合
        load_config
        
        echo "現在の設定:"
        echo "------------"
        cat "$CONFIG_FILE"
        echo "------------"
        echo ""
        
        read -p "設定を編集しますか？ (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ${EDITOR:-vi} "$CONFIG_FILE"
            success "設定を保存しました"
        fi
    fi
    
    exit 0
}

# 日付から年月を取得
get_year_month() {
    local file_path="$1"
    local date_str=""
    
    # まずEXIFデータから撮影日時を取得
    if command -v exiftool &> /dev/null; then
        date_str=$(exiftool -DateTimeOriginal -s3 "$file_path" 2>/dev/null || true)
    fi
    
    # EXIFデータがない場合はファイルの変更日時を使用
    if [ -z "$date_str" ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            date_str=$(stat -f "%Sm" -t "%Y:%m:%d %H:%M:%S" "$file_path")
        else
            date_str=$(stat -c "%y" "$file_path" | cut -d' ' -f1)
        fi
    fi
    
    # YYYY-MM形式に変換
    echo "$date_str" | sed -E 's/^([0-9]{4}):?([0-9]{2}).*$/\1-\2/'
}

# ファイルが日付範囲内かチェック
is_in_date_range() {
    local file_path="$1"
    local file_date=""
    
    # ファイルの日付を取得（YYYY-MM-DD形式）
    if [[ "$OSTYPE" == "darwin"* ]]; then
        file_date=$(stat -f "%Sm" -t "%Y-%m-%d" "$file_path")
    else
        file_date=$(stat -c "%y" "$file_path" | cut -d' ' -f1)
    fi
    
    # 開始日チェック
    if [ -n "$START_DATE" ]; then
        if [[ "$file_date" < "$START_DATE" ]]; then
            return 1
        fi
    fi
    
    # 終了日チェック
    if [ -n "$END_DATE" ]; then
        if [[ "$file_date" > "$END_DATE" ]]; then
            return 1
        fi
    fi
    
    return 0
}

# アップロード済みファイルの記録
record_uploaded() {
    local source_dir="$1"
    local file_path="$2"
    local uploaded_file="$source_dir/.uploaded"
    
    # 相対パスを取得
    local relative_path="${file_path#$source_dir/}"
    
    # ファイルのハッシュ値を計算
    local file_hash=""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        file_hash=$(shasum -a 256 "$file_path" | cut -d' ' -f1)
    else
        file_hash=$(sha256sum "$file_path" | cut -d' ' -f1)
    fi
    
    # タイムスタンプと共に記録
    echo "$(date -Iseconds)|$relative_path|$file_hash" >> "$uploaded_file"
}

# アップロード済みかチェック
is_uploaded() {
    local source_dir="$1"
    local file_path="$2"
    local uploaded_file="$source_dir/.uploaded"
    
    if [ ! -f "$uploaded_file" ]; then
        return 1
    fi
    
    local relative_path="${file_path#$source_dir/}"
    
    # ファイルのハッシュ値を計算
    local file_hash=""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        file_hash=$(shasum -a 256 "$file_path" | cut -d' ' -f1)
    else
        file_hash=$(sha256sum "$file_path" | cut -d' ' -f1)
    fi
    
    # 既にアップロード済みかチェック
    if grep -q "|$relative_path|$file_hash$" "$uploaded_file" 2>/dev/null; then
        return 0
    fi
    
    return 1
}

# ファイルタイプを判定
get_file_type() {
    local file_path="$1"
    local ext="${file_path##*.}"
    ext=$(echo "$ext" | tr '[:upper:]' '[:lower:]')
    
    if [[ ",$RAW_EXTENSIONS," == *",$ext,"* ]]; then
        echo "raw"
    elif [[ ",$JPG_EXTENSIONS," == *",$ext,"* ]]; then
        echo "jpg"
    else
        echo "unknown"
    fi
}

# SDカードから写真を取り込み
import_from_sd() {
    local sd_path="$1"
    local import_date="$2"
    local imported_count=0
    local skipped_count=0
    
    info "SDカードから写真を取り込み中"
    info "ソース: $sd_path"
    info "対象日: $import_date"
    
    # 保存先ディレクトリを作成
    local date_folder=$(echo "$import_date" | sed 's/-//g')
    local dest_dir="$LOCAL_IMPORT_BASE/$date_folder"
    mkdir -p "$dest_dir"
    
    # 全拡張子のパターンを作成
    local all_extensions="$RAW_EXTENSIONS,$JPG_EXTENSIONS"
    local ext_pattern=""
    IFS=',' read -ra EXTS <<< "$all_extensions"
    for ext in "${EXTS[@]}"; do
        ext=$(echo "$ext" | tr -d ' ')
        if [ -n "$ext_pattern" ]; then
            ext_pattern="$ext_pattern|$ext"
        else
            ext_pattern="$ext"
        fi
    done
    
    # ファイルを検索して取り込み
    while IFS= read -r -d '' file_path; do
        local filename=$(basename "$file_path")
        
        # ファイルの作成日をチェック
        local file_date=""
        if [[ "$OSTYPE" == "darwin"* ]]; then
            file_date=$(stat -f "%Sm" -t "%Y-%m-%d" "$file_path")
        else
            file_date=$(stat -c "%y" "$file_path" | cut -d' ' -f1)
        fi
        
        # 対象日のファイルのみ処理
        if [[ "$file_date" != "$import_date" ]]; then
            continue
        fi
        
        # 保存先パスを構築
        local dest_path="$dest_dir/$filename"
        
        # 既存ファイルチェック
        if [ -f "$dest_path" ]; then
            [ "$VERBOSE" = true ] && echo "スキップ（既存）: $filename"
            ((skipped_count++))
            continue
        fi
        
        # ファイルコピー
        if [ "$DRY_RUN" = true ]; then
            echo "[DRY RUN] コピー: $filename → $dest_dir/"
        else
            cp "$file_path" "$dest_path"
            ((imported_count++))
            [ "$VERBOSE" = true ] && success "コピー完了: $filename"
        fi
        
    done < <(find "$sd_path" \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.heic" -o -iname "*.heif" -o -iname "*.dng" -o -iname "*.raf" -o -iname "*.cr2" -o -iname "*.cr3" -o -iname "*.nef" -o -iname "*.arw" -o -iname "*.orf" -o -iname "*.rw2" \) -type f -print0 2>/dev/null)
    
    echo ""
    success "取り込み完了: $imported_count ファイル (スキップ: $skipped_count)"
    
    # 取り込んだファイルをS3にアップロード
    if [ "$imported_count" -gt 0 ] || [ "$DRY_RUN" = true ]; then
        SOURCE_DIR="$dest_dir"
        upload_to_s3
    fi
}

# S3へのアップロード処理
upload_to_s3() {
    local file_count=0
    local skip_count=0
    local upload_count=0
    local total_size=0
    
    load_config
    
    # 全拡張子のパターンを作成
    local all_extensions="$RAW_EXTENSIONS,$JPG_EXTENSIONS"
    local ext_pattern=""
    IFS=',' read -ra EXTS <<< "$all_extensions"
    for ext in "${EXTS[@]}"; do
        ext=$(echo "$ext" | tr -d ' ')
        if [ -n "$ext_pattern" ]; then
            ext_pattern="$ext_pattern|$ext"
        else
            ext_pattern="$ext"
        fi
    done
    
    info "バックアップ開始"
    info "ソース: $SOURCE_DIR"
    info "S3バケット: s3://$S3_BUCKET/"
    
    if [ -n "$START_DATE" ] || [ -n "$END_DATE" ]; then
        info "日付範囲: ${START_DATE:-開始指定なし} 〜 ${END_DATE:-終了指定なし}"
    fi
    
    if [ "$DRY_RUN" = true ]; then
        warning "ドライランモード: 実際にはアップロードしません"
    fi
    
    echo ""
    
    # ファイルを検索して処理
    while IFS= read -r -d '' file_path; do
        ((file_count++))
        
        # ファイル名を取得
        local filename=$(basename "$file_path")
        
        # 除外パターンチェック
        local skip=false
        IFS=',' read -ra EXCLUDES <<< "$EXCLUDE_PATTERNS"
        for pattern in "${EXCLUDES[@]}"; do
            pattern=$(echo "$pattern" | tr -d ' ')
            if [[ "$filename" == *"$pattern"* ]]; then
                skip=true
                break
            fi
        done
        
        if [ "$skip" = true ]; then
            [ "$VERBOSE" = true ] && echo "スキップ（除外パターン）: $filename"
            ((skip_count++))
            continue
        fi
        
        # 日付範囲チェック
        if ! is_in_date_range "$file_path"; then
            [ "$VERBOSE" = true ] && echo "スキップ（日付範囲外）: $filename"
            ((skip_count++))
            continue
        fi
        
        # アップロード済みチェック
        if is_uploaded "$SOURCE_DIR" "$file_path"; then
            [ "$VERBOSE" = true ] && echo "スキップ（アップロード済み）: $filename"
            ((skip_count++))
            continue
        fi
        
        # 年月フォルダを取得
        local year_month=$(get_year_month "$file_path")
        
        # ファイルタイプを判定してS3パスを構築
        local file_type=$(get_file_type "$file_path")
        local s3_prefix=""
        
        case "$file_type" in
            raw)
                s3_prefix="$S3_PREFIX_RAW"
                ;;
            jpg)
                s3_prefix="$S3_PREFIX_JPG"
                ;;
            *)
                [ "$VERBOSE" = true ] && echo "スキップ（未対応形式）: $filename"
                ((skip_count++))
                continue
                ;;
        esac
        
        local s3_path="s3://$S3_BUCKET/$s3_prefix/$year_month/$filename"
        
        # ファイルサイズを取得
        local file_size=""
        if [[ "$OSTYPE" == "darwin"* ]]; then
            file_size=$(stat -f "%z" "$file_path")
        else
            file_size=$(stat -c "%s" "$file_path")
        fi
        total_size=$((total_size + file_size))
        
        # アップロード実行
        if [ "$DRY_RUN" = true ]; then
            echo "[DRY RUN] $filename → $s3_path"
        else
            echo "アップロード中: $filename → $year_month/"
            
            if aws s3 cp "$file_path" "$s3_path" \
                --profile "$AWS_PROFILE" \
                --region "$AWS_REGION" \
                --storage-class "${S3_STORAGE_CLASS:-STANDARD}" \
                --no-progress; then
                record_uploaded "$SOURCE_DIR" "$file_path"
                ((upload_count++))
                [ "$VERBOSE" = true ] && success "完了: $filename"
            else
                error "アップロード失敗: $filename"
            fi
        fi
        
    done < <(find "$SOURCE_DIR" \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.heic" -o -iname "*.heif" -o -iname "*.dng" -o -iname "*.raf" -o -iname "*.cr2" -o -iname "*.cr3" -o -iname "*.nef" -o -iname "*.arw" -o -iname "*.orf" -o -iname "*.rw2" \) -type f -print0 2>/dev/null)
    
    # サマリー表示
    echo ""
    echo "===================="
    echo "バックアップ完了"
    echo "===================="
    echo "総ファイル数: $file_count"
    echo "アップロード: $upload_count"
    echo "スキップ: $skip_count"
    echo "総サイズ: $(echo "scale=2; $total_size / 1024 / 1024" | bc) MB"
    
    if [ "$DRY_RUN" = true ]; then
        echo ""
        warning "これはドライランでした。実際にアップロードするには --dry-run を外してください"
    fi
}

# 引数解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--source)
            SOURCE_DIR="$2"
            shift 2
            ;;
        -i|--import)
            IMPORT_MODE=true
            SD_PATH="$2"
            shift 2
            ;;
        --import-date)
            IMPORT_DATE="$2"
            shift 2
            ;;
        --start)
            START_DATE="$2"
            shift 2
            ;;
        --end)
            END_DATE="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -c|--config)
            edit_config
            ;;
        -h|--help)
            usage
            ;;
        *)
            error "不明なオプション: $1"
            ;;
    esac
done

# モードチェック
if [ "$IMPORT_MODE" = true ]; then
    # インポートモード
    if [ -z "$SD_PATH" ]; then
        error "SDカードのパスを指定してください"
    fi
    
    if [ ! -d "$SD_PATH" ]; then
        error "ディレクトリが存在しません: $SD_PATH"
    fi
    
    # デフォルトで今日の日付を使用
    if [ -z "$IMPORT_DATE" ]; then
        IMPORT_DATE=$(date +"%Y-%m-%d")
    fi
else
    # 通常のバックアップモード
    if [ -z "$SOURCE_DIR" ]; then
        error "ソースディレクトリを指定してください（-s オプション）"
    fi
    
    if [ ! -d "$SOURCE_DIR" ]; then
        error "ディレクトリが存在しません: $SOURCE_DIR"
    fi
fi

# AWS CLIの存在チェック
if ! command -v aws &> /dev/null; then
    error "AWS CLIがインストールされていません"
fi

# AWS認証チェック
if ! aws sts get-caller-identity --profile "${AWS_PROFILE:-default}" &> /dev/null; then
    error "AWS認証に失敗しました。aws configure を実行してください"
fi

# メイン処理実行
if [ "$IMPORT_MODE" = true ]; then
    import_from_sd "$SD_PATH" "$IMPORT_DATE"
else
    upload_to_s3
fi