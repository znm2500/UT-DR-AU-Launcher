#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use futures_util::StreamExt;
use maxminddb::geoip2;
use public_ip;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::collections::HashSet;
use std::collections::VecDeque;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{LazyLock, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};
const HALF_GB_BYTES: u64 = 720 * 1024 * 1024;
const TWO_GB_BYTES: u64 = 2 * 1024 * 1024 * 1024;
static RUNNING_GAMES: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));

#[derive(Debug, Clone, Copy)]
enum ArchiveKind {
    Zip,
    SevenZ,
}

#[derive(Debug, Deserialize)]
struct GithubSnapshot {
    #[serde(rename = "baseSha")]
    base_sha: Option<String>,
    #[serde(rename = "baseConfig")]
    base_config: Option<Value>,
}

#[derive(Debug, Serialize)]
struct ParseAupResult {
    games: Vec<Value>,
    #[serde(rename = "tempDir")]
    temp_dir: String,
}

#[derive(Debug, Serialize)]
struct HighscoreResult {
    ok: bool,
    score: Option<u64>,
    sha: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct PublicGithubConfig {
    owner: String,
    repo: String,
    branch: String,
    #[serde(rename = "configPath")]
    config_path: String,
    #[serde(rename = "githubDataOwner")]
    github_data_owner: String,
    #[serde(rename = "githubDataRepo")]
    github_data_repo: String,
    #[serde(rename = "githubDataBranch")]
    github_data_branch: String,
}

#[derive(Debug, Serialize)]
struct GitcodeFileContent {
    content: String,
    sha: String,
}

#[derive(Debug, Clone)]
struct LocalConfig {
    gitcode_owner: String,
    gitcode_repo: String,
    gitcode_branch: String,
    gitcode_config_path: String,
    gitcode_token: String,
    wecom_webhook_url: String,
}

static LOCAL_CONFIG_CACHE: LazyLock<Mutex<Option<LocalConfig>>> =
    LazyLock::new(|| Mutex::new(None));

const DEFAULT_GITCODE_OWNER: &str = "znm1145";
const DEFAULT_GITCODE_REPO: &str = "AU-Launcher-Repo";
const DEFAULT_GITCODE_BRANCH: &str = "data";
const DEFAULT_GITCODE_CONFIG_PATH: &str = "config.json";
const DEFAULT_GITHUB_DATA_OWNER: &str = "znm2500";
const DEFAULT_GITHUB_DATA_REPO: &str = "AU-Launcher-Repo";
const DEFAULT_GITHUB_DATA_BRANCH: &str = "data";

#[derive(Debug, Deserialize)]
struct SubmitGameApplicationPayload {
    name: String,
    link: String,
    desc: Option<String>,
    #[serde(rename = "submitTime")]
    submit_time: String,
    #[serde(rename = "imageBase64")]
    image_base64: Option<String>,
    #[serde(rename = "imageMd5")]
    image_md5: Option<String>,
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|v| v.as_millis())
        .unwrap_or(0)
}

fn normalize_property_value(value: &str) -> String {
    value.trim().trim_matches('"').to_string()
}

fn parse_local_properties(contents: &str) -> HashMap<String, String> {
    let mut values = HashMap::new();

    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with(';') {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once('=') {
            values.insert(key.trim().to_string(), normalize_property_value(value));
        }
    }

    values
}

fn local_properties_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    let mut push_ancestors = |start: Option<PathBuf>| {
        if let Some(path) = start {
            let base = if path.is_file() {
                path.parent().map(Path::to_path_buf).unwrap_or(path)
            } else {
                path
            };

            for ancestor in base.ancestors() {
                let candidate = ancestor.join("local.properties");
                if seen.insert(candidate.clone()) {
                    candidates.push(candidate);
                }
            }
        }
    };

    push_ancestors(std::env::current_dir().ok());
    push_ancestors(std::env::current_exe().ok());

    candidates
}

fn required_property(
    values: &HashMap<String, String>,
    keys: &[&str],
    label: &str,
) -> Result<String, String> {
    for key in keys {
        if let Some(value) = values.get(*key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Ok(trimmed.to_string());
            }
        }
    }

    Err(format!("Missing required property: {}", label))
}

fn optional_property(values: &HashMap<String, String>, keys: &[&str], fallback: &str) -> String {
    for key in keys {
        if let Some(value) = values.get(*key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }

    fallback.to_string()
}

fn load_public_github_config() -> PublicGithubConfig {
    for candidate in local_properties_candidates() {
        if let Ok(contents) = fs::read_to_string(&candidate) {
            let values = parse_local_properties(&contents);
            return PublicGithubConfig {
                owner: optional_property(
                    &values,
                    &["gitcode.owner", "gitcode_owner"],
                    DEFAULT_GITCODE_OWNER,
                ),
                repo: optional_property(
                    &values,
                    &["gitcode.repo", "gitcode_repo"],
                    DEFAULT_GITCODE_REPO,
                ),
                branch: optional_property(
                    &values,
                    &["gitcode.branch", "gitcode_branch"],
                    DEFAULT_GITCODE_BRANCH,
                ),
                config_path: optional_property(
                    &values,
                    &["gitcode.config_path", "gitcode_config_path"],
                    DEFAULT_GITCODE_CONFIG_PATH,
                ),
                github_data_owner: optional_property(
                    &values,
                    &["github.data_owner", "github_data_owner"],
                    DEFAULT_GITHUB_DATA_OWNER,
                ),
                github_data_repo: optional_property(
                    &values,
                    &["github.data_repo", "github_data_repo"],
                    DEFAULT_GITHUB_DATA_REPO,
                ),
                github_data_branch: optional_property(
                    &values,
                    &["github.data_branch", "github_data_branch"],
                    DEFAULT_GITHUB_DATA_BRANCH,
                ),
            };
        }
    }

    PublicGithubConfig {
        owner: DEFAULT_GITCODE_OWNER.to_string(),
        repo: DEFAULT_GITCODE_REPO.to_string(),
        branch: DEFAULT_GITCODE_BRANCH.to_string(),
        config_path: DEFAULT_GITCODE_CONFIG_PATH.to_string(),
        github_data_owner: DEFAULT_GITHUB_DATA_OWNER.to_string(),
        github_data_repo: DEFAULT_GITHUB_DATA_REPO.to_string(),
        github_data_branch: DEFAULT_GITHUB_DATA_BRANCH.to_string(),
    }
}

fn load_local_config() -> Result<LocalConfig, String> {
    if let Some(cached) = LOCAL_CONFIG_CACHE
        .lock()
        .map_err(|err| err.to_string())?
        .clone()
    {
        return Ok(cached);
    }

    let mut last_error = None;
    for candidate in local_properties_candidates() {
        match fs::read_to_string(&candidate) {
            Ok(contents) => {
                let values = parse_local_properties(&contents);
                let config = LocalConfig {
                    gitcode_owner: required_property(
                        &values,
                        &["gitcode.owner", "gitcode_owner"],
                        "gitcode.owner",
                    )?,
                    gitcode_repo: required_property(
                        &values,
                        &["gitcode.repo", "gitcode_repo"],
                        "gitcode.repo",
                    )?,
                    gitcode_branch: required_property(
                        &values,
                        &["gitcode.branch", "gitcode_branch"],
                        "gitcode.branch",
                    )?,
                    gitcode_config_path: required_property(
                        &values,
                        &["gitcode.config_path", "gitcode_config_path"],
                        "gitcode.config_path",
                    )?,
                    gitcode_token: required_property(
                        &values,
                        &["gitcode.token", "gitcode_token"],
                        "gitcode.token",
                    )?,
                    wecom_webhook_url: required_property(
                        &values,
                        &[
                            "wecom.webhook_url",
                            "wecom_webhook_url",
                            "wechat.webhook_url",
                        ],
                        "wecom.webhook_url",
                    )?,
                };

                let mut cache = LOCAL_CONFIG_CACHE.lock().map_err(|err| err.to_string())?;
                *cache = Some(config.clone());
                return Ok(config);
            }
            Err(err) => {
                last_error = Some(format!("{}: {}", candidate.display(), err));
            }
        }
    }

    Err(last_error.unwrap_or_else(|| {
        "Missing local.properties. Create it in the project root and fill in GitCode / WeCom values.".to_string()
    }))
}

fn calculate_dir_size(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }

    WalkDir::new(path)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .filter_map(|entry| entry.metadata().ok())
        .map(|meta| meta.len())
        .sum()
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    if !src.exists() {
        return Err(format!("source path not found: {}", src.display()));
    }

    if src.is_file() {
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        }
        fs::copy(src, dst).map_err(|err| err.to_string())?;
        return Ok(());
    }

    fs::create_dir_all(dst).map_err(|err| err.to_string())?;

    for entry in WalkDir::new(src).into_iter().filter_map(Result::ok) {
        let source_path = entry.path();
        let relative = source_path
            .strip_prefix(src)
            .map_err(|err| err.to_string())?;
        let target_path = dst.join(relative);

        if entry.file_type().is_dir() {
            fs::create_dir_all(&target_path).map_err(|err| err.to_string())?;
        } else {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent).map_err(|err| err.to_string())?;
            }
            fs::copy(source_path, target_path).map_err(|err| err.to_string())?;
        }
    }

    Ok(())
}

fn detect_archive_kind(archive_path: &Path) -> Result<ArchiveKind, String> {
    let mut file = File::open(archive_path).map_err(|err| err.to_string())?;
    let mut header = [0_u8; 8];
    let bytes_read = file.read(&mut header).map_err(|err| err.to_string())?;

    if bytes_read >= 6 && header[..6] == [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C] {
        return Ok(ArchiveKind::SevenZ);
    }

    if bytes_read >= 4 {
        let zip_magic = &header[..4];
        if zip_magic == [0x50, 0x4B, 0x03, 0x04]
            || zip_magic == [0x50, 0x4B, 0x05, 0x06]
            || zip_magic == [0x50, 0x4B, 0x07, 0x08]
        {
            return Ok(ArchiveKind::Zip);
        }
    }

    let ext = archive_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if ext == "7z" || ext == "aup" {
        return Ok(ArchiveKind::SevenZ);
    }
    if ext == "zip" {
        return Ok(ArchiveKind::Zip);
    }

    Err(format!(
        "unsupported archive format: {}",
        archive_path.to_string_lossy()
    ))
}

fn extract_zip(archive_path: &Path, output_dir: &Path) -> Result<(), String> {
    let file = File::open(archive_path).map_err(|err| err.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|err| err.to_string())?;

    fs::create_dir_all(output_dir).map_err(|err| err.to_string())?;

    for idx in 0..archive.len() {
        let mut entry = archive.by_index(idx).map_err(|err| err.to_string())?;
        let enclosed = entry
            .enclosed_name()
            .ok_or_else(|| "invalid archive entry path".to_string())?
            .to_path_buf();
        let out_path = output_dir.join(enclosed);

        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|err| err.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|err| err.to_string())?;
            }
            let mut outfile = File::create(&out_path).map_err(|err| err.to_string())?;
            std::io::copy(&mut entry, &mut outfile).map_err(|err| err.to_string())?;
        }
    }

    Ok(())
}

fn extract_7z(archive_path: &Path, output_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(output_dir).map_err(|err| err.to_string())?;
    sevenz_rust::decompress_file(archive_path, output_dir).map_err(|err| err.to_string())
}

fn extract_archive(archive_path: &Path, output_dir: &Path) -> Result<(), String> {
    match detect_archive_kind(archive_path)? {
        ArchiveKind::Zip => extract_zip(archive_path, output_dir),
        ArchiveKind::SevenZ => extract_7z(archive_path, output_dir),
    }
}

fn zip_directory_with_progress(
    source_dir: &Path,
    save_file: &Path,
    app: &AppHandle,
    start_percent: u32,
) -> Result<(), String> {
    if let Some(parent) = save_file.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    let zip_file = File::create(save_file).map_err(|err| err.to_string())?;
    let mut zip = ZipWriter::new(zip_file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    let files: Vec<PathBuf> = WalkDir::new(source_dir)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .map(|entry| entry.path().to_path_buf())
        .collect();

    let total = files.len().max(1) as u32;

    for (idx, file_path) in files.iter().enumerate() {
        let relative = file_path
            .strip_prefix(source_dir)
            .map_err(|err| err.to_string())?
            .to_string_lossy()
            .replace('\\', "/");

        zip.start_file(relative, options)
            .map_err(|err| err.to_string())?;

        let mut input = File::open(file_path).map_err(|err| err.to_string())?;
        let mut buffer = Vec::new();
        input
            .read_to_end(&mut buffer)
            .map_err(|err| err.to_string())?;
        zip.write_all(&buffer).map_err(|err| err.to_string())?;

        let current = idx as u32 + 1;
        let mapped = start_percent + (current * 70 / total);
        let _ = app.emit("zip-progress", mapped.min(100));
    }

    zip.finish().map_err(|err| err.to_string())?;
    Ok(())
}

fn get_gitcode_config() -> Result<(String, String, String, String, String), String> {
    let config = load_local_config()?;
    Ok((
        config.gitcode_owner,
        config.gitcode_repo,
        config.gitcode_branch,
        config.gitcode_config_path,
        config.gitcode_token,
    ))
}

#[tauri::command]
async fn get_gitcode_file_content(path_in_repo: String) -> Result<GitcodeFileContent, String> {
    let (owner, repo, branch, _, token) = get_gitcode_config()?;
    if token.is_empty() {
        return Err("Missing GitCode token".to_string());
    }

    let encoded_path = path_in_repo
        .split('/')
        .map(urlencoding::encode)
        .collect::<Vec<_>>()
        .join("/");
    let api_url = format!(
        "https://api.gitcode.com/api/v5/repos/{}/{}/contents/{}",
        owner, repo, encoded_path
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&api_url)
        .query(&[("ref", branch.as_str()), ("access_token", token.as_str())])
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|err| err.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "GitCode API request failed with status: {}",
            response.status()
        ));
    }

    let remote: Value = response.json().await.map_err(|err| err.to_string())?;
    let content = remote
        .get("content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "missing content in gitcode response".to_string())?;
    let sha = remote
        .get("sha")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

    Ok(GitcodeFileContent {
        content: content.replace('\n', ""),
        sha,
    })
}

fn ensure_parent_exists(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn normalized_game_key(file_path: &str) -> String {
    let canonical = PathBuf::from(file_path)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(file_path));
    #[cfg(target_os = "windows")]
    {
        canonical.to_string_lossy().to_ascii_lowercase()
    }
    #[cfg(not(target_os = "windows"))]
    {
        canonical.to_string_lossy().to_string()
    }
}

fn resolve_game_executable_path(path: &Path) -> Result<PathBuf, String> {
    if path.is_file() {
        return Ok(path.to_path_buf());
    }
    if !path.is_dir() {
        return Err(format!("Path not found: {}", path.display()));
    }

    let mut queue = VecDeque::new();
    queue.push_back(path.to_path_buf());

    while let Some(dir) = queue.pop_front() {
        let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let file_type = entry.file_type().map_err(|e| e.to_string())?;
            let entry_path = entry.path();

            if file_type.is_file() {
                if let Some(name) = entry_path.file_name().and_then(|n| n.to_str()) {
                    if name.eq_ignore_ascii_case("game.exe") {
                        return Ok(entry_path);
                    }
                }
            } else if file_type.is_dir() {
                queue.push_back(entry_path); // 子目录放入队列尾部，实现按层扩展
            }
        }
    }

    Err(format!("在所有层级中未找到 game.exe: {}", path.display()))
}

#[tauri::command]
fn find_game_executable(root_path: String) -> Result<String, String> {
    resolve_game_executable_path(Path::new(&root_path))
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
async fn launch_game(file_path: String) -> Result<String, String> {
    let target = resolve_game_executable_path(Path::new(&file_path))?;

    let game_key = normalized_game_key(&target.to_string_lossy());
    {
        let mut running_games = RUNNING_GAMES.lock().map_err(|err| err.to_string())?;
        if running_games.contains(&game_key) {
            return Err("游戏已在运行中，请勿重复启动".to_string());
        }
        running_games.insert(game_key.clone());
    }

    let mut child = {
        #[cfg(target_os = "windows")]
        {
            Command::new(&target)
                .spawn()
                .map_err(|err| err.to_string())?
        }

        #[cfg(not(target_os = "windows"))]
        {
            Command::new("wine")
                .arg(&target)
                .spawn()
                .map_err(|err| err.to_string())?
        }
    };

    let wait_result = tauri::async_runtime::spawn_blocking(move || child.wait())
        .await
        .map_err(|err| err.to_string());

    {
        let mut running_games = RUNNING_GAMES.lock().map_err(|err| err.to_string())?;
        running_games.remove(&game_key);
    }

    let status = wait_result
        .map_err(|err| format!("等待游戏进程失败: {}", err))
        .and_then(|result| result.map_err(|err| format!("等待游戏进程失败: {}", err)))?;

    if status.success() {
        Ok("游戏已退出".to_string())
    } else {
        Err(format!("游戏异常退出，状态码: {:?}", status.code()))
    }
}

#[tauri::command]
fn get_local_path(key: String) -> Result<String, String> {
    let path = match key.as_str() {
        "downloads" => dirs::download_dir().or_else(dirs::home_dir),
        "music" => dirs::audio_dir().or_else(dirs::home_dir),
        "temp" => Some(std::env::temp_dir()),
        _ => dirs::home_dir(),
    }
    .ok_or_else(|| format!("unable to resolve local path for key: {}", key))?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn folder_is_existed(folder_path: String) -> bool {
    Path::new(&folder_path).exists()
}

#[tauri::command]
fn is_parent_dir(child_path: String, target_parent_path: String) -> bool {
    let child = PathBuf::from(child_path);
    let target = PathBuf::from(target_parent_path);

    let resolved_child_parent = child
        .canonicalize()
        .ok()
        .and_then(|path| path.parent().map(|parent| parent.to_path_buf()));
    let resolved_target = target.canonicalize().ok();

    match (resolved_child_parent, resolved_target) {
        (Some(actual), Some(expected)) => {
            #[cfg(target_os = "windows")]
            {
                actual
                    .to_string_lossy()
                    .eq_ignore_ascii_case(&expected.to_string_lossy())
            }
            #[cfg(not(target_os = "windows"))]
            {
                actual == expected
            }
        }
        _ => false,
    }
}

#[tauri::command]
fn read_bgm_files(bgm_path: String) -> Result<Vec<String>, String> {
    let path = PathBuf::from(&bgm_path);
    if !path.exists() {
        return Err(format!("directory not found: {}", bgm_path));
    }

    let mut files = Vec::new();
    for entry in fs::read_dir(path).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let item_path = entry.path();
        if item_path.is_file() {
            let ext = item_path
                .extension()
                .and_then(|value| value.to_str())
                .map(|value| value.to_ascii_lowercase())
                .unwrap_or_default();

            if ext == "mp3" || ext == "wav" || ext == "ogg" {
                files.push(item_path.to_string_lossy().to_string());
            }
        }
    }

    Ok(files)
}

#[tauri::command]
fn rename_directory(old_path: String, new_name: String) -> Result<(), String> {
    let old = PathBuf::from(old_path);
    let parent = old
        .parent()
        .ok_or_else(|| "invalid source path".to_string())?;
    let target = parent.join(new_name);

    if target.exists() {
        return Ok(());
    }

    fs::rename(old, target).map_err(|err| err.to_string())
}

#[tauri::command]
async fn move_folder(archive_path: String, dest_dir: String) -> Result<(), String> {
    let src = PathBuf::from(archive_path);
    let dst = PathBuf::from(dest_dir);
    copy_dir_recursive(&src, &dst)
}

#[tauri::command]
async fn remove_directory(dir_path: String) -> Result<bool, String> {
    let target = PathBuf::from(&dir_path);
    if !target.exists() {
        return Ok(true);
    }

    if target.is_dir() {
        fs::remove_dir_all(target).map_err(|err| err.to_string())?;
        return Ok(true);
    }

    let parent = target
        .parent()
        .ok_or_else(|| "invalid file path".to_string())?
        .to_path_buf();

    let size = calculate_dir_size(&parent);
    if size > HALF_GB_BYTES {
        if target.exists() {
            fs::remove_file(target).map_err(|err| err.to_string())?;
        }
    } else if parent.exists() {
        fs::remove_dir_all(parent).map_err(|err| err.to_string())?;
    }

    Ok(true)
}

#[tauri::command]
async fn download_and_extract(
    app: AppHandle,
    download_url: String,
    dest_dir: String,
    filename: String,
    game_id: String,
) -> Result<bool, String> {
    let save_path = std::env::temp_dir().join(filename);
    ensure_parent_exists(&save_path)?;

    let response = reqwest::Client::new()
        .get(&download_url)
        .send()
        .await
        .map_err(|err| err.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "download failed with status: {}",
            response.status()
        ));
    }

    let total_length = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut writer = File::create(&save_path).map_err(|err| err.to_string())?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|err| err.to_string())?;
        writer.write_all(&chunk).map_err(|err| err.to_string())?;
        downloaded += chunk.len() as u64;

        if total_length > 0 {
            let percent = ((downloaded as f64 / total_length as f64) * 100.0).floor() as u32;
            let _ = app.emit(
                "download-progress",
                json!({
                  "id": game_id,
                  "percent": percent.min(100)
                }),
            );
        }
    }

    extract_archive(&save_path, Path::new(&dest_dir))?;
    let _ = app.emit(
        "download-progress",
        json!({
          "id": game_id,
          "percent": 100
        }),
    );

    let _ = fs::remove_file(save_path);
    Ok(true)
}

#[tauri::command]
async fn parse_aup(app: AppHandle, archive_path: String) -> Result<ParseAupResult, String> {
    let temp_dir =
        std::env::temp_dir().join(format!("au_export_{}_{}", now_millis(), std::process::id()));

    fs::create_dir_all(&temp_dir).map_err(|err| err.to_string())?;
    extract_archive(Path::new(&archive_path), &temp_dir)?;

    let config_path = temp_dir.join("config.json");
    let json_raw = fs::read_to_string(config_path).map_err(|err| err.to_string())?;
    let parsed: Value = serde_json::from_str(&json_raw).map_err(|err| err.to_string())?;

    let games = if parsed.is_array() {
        parsed.as_array().cloned().unwrap_or_default()
    } else {
        parsed
            .get("games")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default()
    };

    let _ = app.emit("zip-progress", 100_u32);

    Ok(ParseAupResult {
        games,
        temp_dir: temp_dir.to_string_lossy().to_string(),
    })
}

#[tauri::command]
async fn export_game(
    app: AppHandle,
    games_to_export: Vec<Value>,
    save_dir: String,
) -> Result<bool, String> {
    let temp_dir =
        std::env::temp_dir().join(format!("au_export_{}_{}", now_millis(), std::process::id()));
    fs::create_dir_all(&temp_dir).map_err(|err| err.to_string())?;

    let result = (|| -> Result<bool, String> {
        let config_path = temp_dir.join("config.json");
        let config_json =
            serde_json::to_string_pretty(&games_to_export).map_err(|err| err.to_string())?;
        fs::write(config_path, config_json).map_err(|err| err.to_string())?;

        let total_games = games_to_export.len().max(1) as u32;
        for (index, metadata) in games_to_export.iter().enumerate() {
            let execution_path = metadata
                .get("execution_path")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "missing execution_path in export metadata".to_string())?;
            let version = metadata
                .get("version")
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            let game_id = metadata
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown_game");
            let game_name = metadata
                .get("name")
                .and_then(|v| v.get("en"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");

            let exe_path = PathBuf::from(execution_path);
            let game_root = if version == "0.0.2" {
                exe_path
                    .parent()
                    .map(|p| p.join("Mods").join(game_name))
                    .ok_or_else(|| "invalid execution path".to_string())?
            } else {
                exe_path
                    .parent()
                    .map(Path::to_path_buf)
                    .ok_or_else(|| "invalid execution path".to_string())?
            };

            let game_dest_dir = temp_dir.join(game_id);
            fs::create_dir_all(&game_dest_dir).map_err(|err| err.to_string())?;

            if game_root.exists() && game_root.is_dir() {
                let folder_size = calculate_dir_size(&game_root);
                if folder_size < TWO_GB_BYTES {
                    copy_dir_recursive(&game_root, &game_dest_dir)?;
                } else {
                    let file_name = exe_path
                        .file_name()
                        .ok_or_else(|| "invalid executable name".to_string())?;
                    let dest_exe = game_dest_dir.join(file_name);
                    fs::copy(exe_path, dest_exe).map_err(|err| err.to_string())?;
                }
            }

            let progress = (((index as u32 + 1) * 100) / total_games) * 30 / 100;
            let _ = app.emit("zip-progress", progress.min(30));
        }

        let out_file = PathBuf::from(&save_dir);
        if out_file.exists() {
            fs::remove_file(&out_file).map_err(|err| err.to_string())?;
        }

        zip_directory_with_progress(&temp_dir, &out_file, &app, 30)?;
        Ok(true)
    })();

    let _ = fs::remove_dir_all(&temp_dir);
    result
}

#[tauri::command]
fn get_github_config_public() -> PublicGithubConfig {
    load_public_github_config()
}

#[tauri::command]
async fn increment_remote_highscore(
    game_id: String,
    snapshot: Option<GithubSnapshot>,
) -> HighscoreResult {
    let result: Result<HighscoreResult, String> = async {
        let (owner, repo, branch, config_path, token) = get_gitcode_config()?;
        if token.is_empty() {
            return Err("Missing GitCode token".to_string());
        }

        let encoded_path = config_path
            .split('/')
            .map(urlencoding::encode)
            .collect::<Vec<_>>()
            .join("/");
        let api_url = format!(
            "https://api.gitcode.com/api/v5/repos/{}/{}/contents/{}",
            owner, repo, encoded_path
        );

        let client = reqwest::Client::new();

        let mut parsed = snapshot.as_ref().and_then(|s| s.base_config.clone());
        let mut base_sha = snapshot
            .as_ref()
            .and_then(|s| s.base_sha.clone())
            .unwrap_or_default();

        if parsed.is_none() || base_sha.is_empty() {
            let get_res = client
                .get(&api_url)
                .query(&[("ref", branch.as_str()), ("access_token", token.as_str())])
                .header("Accept", "application/json")
                .send()
                .await
                .map_err(|err| err.to_string())?;

            let remote: Value = get_res.json().await.map_err(|err| err.to_string())?;
            let content = remote
                .get("content")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "missing content in gitcode response".to_string())?;
            let decoded = STANDARD
                .decode(content.replace('\n', ""))
                .map_err(|err| err.to_string())?;
            let decoded_text = String::from_utf8(decoded).map_err(|err| err.to_string())?;

            parsed = Some(serde_json::from_str(&decoded_text).map_err(|err| err.to_string())?);
            base_sha = remote
                .get("sha")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
        }

        if base_sha.is_empty() {
            return Err("Missing base sha for remote update".to_string());
        }

        let mut config = parsed.ok_or_else(|| "missing base config".to_string())?;
        let games = config
            .get_mut("games")
            .and_then(|v| v.as_array_mut())
            .ok_or_else(|| "invalid remote games payload".to_string())?;

        let mut updated_score: Option<u64> = None;
        for game in games.iter_mut() {
            if game.get("id").and_then(|v| v.as_str()) == Some(game_id.as_str()) {
                let prev = game.get("hot_score").and_then(|v| v.as_u64()).unwrap_or(0);
                let next = prev + 1;
                game["hot_score"] = json!(next);
                updated_score = Some(next);
                break;
            }
        }

        let score = updated_score.ok_or_else(|| format!("Game not found: {}", game_id))?;
        let updated_content = STANDARD.encode(format!(
            "{}\n",
            serde_json::to_string_pretty(&config).map_err(|err| err.to_string())?
        ));

        let put_res = client
            .put(&api_url)
            .query(&[("access_token", token.as_str())])
            .header("Accept", "application/json")
            .json(&json!({
              "message": format!("chore: bump hot_score for {}", game_id),
              "content": updated_content,
              "sha": base_sha,
              "branch": branch
            }))
            .send()
            .await
            .map_err(|err| err.to_string())?;

        let put_json: Value = put_res.json().await.map_err(|err| err.to_string())?;
        let new_sha = put_json
            .get("content")
            .and_then(|v| v.get("sha"))
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        Ok(HighscoreResult {
            ok: true,
            score: Some(score),
            sha: Some(new_sha),
            error: None,
        })
    }
    .await;

    match result {
        Ok(data) => data,
        Err(err) => HighscoreResult {
            ok: false,
            score: None,
            sha: None,
            error: Some(err),
        },
    }
}

#[tauri::command]
async fn check_local_ip_region() -> bool {
    // --- 第一步：使用 public-ip 库获取公网 IP ---
    // addr() 会从可用的外部服务解析当前公网 IP
    let ip = match public_ip::addr().await {
        Some(ip) => ip,
        None => return false, // 如果没联网或解析失败
    };

    // --- 第二步：本地判断逻辑 (GeoLite2) ---
    // 提示：你需要下载 GeoLite2-Country.mmdb 并放在项目目录下
    let reader = match maxminddb::Reader::open_readfile("resources/GeoLite2-Country.mmdb") {
        Ok(r) => r,
        Err(_) => return false,
    };

    let lookup: Result<geoip2::City, _> = reader.lookup(ip);
    let city = match lookup {
        Ok(c) => c,
        Err(_) => return false,
    };

    // --- 第三步：精细化地区过滤 ---
    // 1. 验证国家码
    let country_code = city.country.as_ref().and_then(|c| c.iso_code);
    if country_code != Some("CN") {
        return false;
    }

    // 2. 排除港澳台 (ISO-3166-2 标准)
    // 在 MaxMind 数据库中，这些通常记录在 subdivisions 中
    if let Some(subdivisions) = city.subdivisions {
        if let Some(first_sub) = subdivisions.first() {
            if let Some(iso) = first_sub.iso_code {
                match iso {
                    "HK" | "MO" | "TW" => return false,
                    _ => {}
                }
            }
        }
    }

    true
}
#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("only http(s) url is allowed".to_string());
    }

    webbrowser::open(&url).map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
async fn submit_game_application(payload: SubmitGameApplicationPayload) -> Result<(), String> {
    let name = payload.name.trim().to_string();
    let link = payload.link.trim().to_string();
    if name.is_empty() || link.is_empty() {
        return Err("game name and download link are required".to_string());
    }

    let config = load_local_config()?;
    let webhook_url = config.wecom_webhook_url;
    if webhook_url.trim().is_empty() {
        return Err("Missing WeCom webhook url".to_string());
    }

    let desc = payload
        .desc
        .unwrap_or_else(|| "无".to_string())
        .trim()
        .to_string();
    let submit_time = payload.submit_time.trim().to_string();
    let markdown_content = format!(
    "### 收到新的游戏申请\n> **游戏名称**：<font color=\"info\">{}</font>\n> **下载链接**：[点击查看]({})\n> **补充说明**：{}\n> **提交时间**：{}",
    name, link, desc, submit_time
  );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|err| err.to_string())?;

    let text_res = client
        .post(&webhook_url)
        .header("Content-Type", "application/json")
        .json(&json!({
          "msgtype": "markdown",
          "markdown": {
            "content": markdown_content
          }
        }))
        .send()
        .await
        .map_err(|err| format!("submit text message failed: {}", err))?;

    if !text_res.status().is_success() {
        let status = text_res.status();
        let body = text_res.text().await.unwrap_or_default();
        return Err(format!("text webhook rejected: {} {}", status, body));
    }

    let image_base64 = payload.image_base64.unwrap_or_default();
    let image_md5 = payload.image_md5.unwrap_or_default();
    if !image_base64.is_empty() && !image_md5.is_empty() {
        let image_res = client
            .post(&webhook_url)
            .header("Content-Type", "application/json")
            .json(&json!({
              "msgtype": "image",
              "image": {
                "base64": image_base64,
                "md5": image_md5
              }
            }))
            .send()
            .await
            .map_err(|err| format!("submit image message failed: {}", err))?;

        if !image_res.status().is_success() {
            let status = image_res.status();
            let body = image_res.text().await.unwrap_or_default();
            return Err(format!("image webhook rejected: {} {}", status, body));
        }
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            find_game_executable,
            launch_game,
            get_local_path,
            folder_is_existed,
            is_parent_dir,
            read_bgm_files,
            rename_directory,
            move_folder,
            remove_directory,
            download_and_extract,
            parse_aup,
            export_game,
            get_github_config_public,
            get_gitcode_file_content,
            increment_remote_highscore,
            check_local_ip_region,
            open_external_url,
            submit_game_application,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
