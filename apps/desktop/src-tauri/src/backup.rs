//! Daily backups of the database to a folder the teacher picks (OneDrive works).
//!
//! The frontend writes the copy with `VACUUM INTO` on its own connection, which
//! gives a complete, consistent file even while TWIG is open. Rust picks the
//! folder, then renames the finished copy into place and deletes old ones. The
//! copy is written under a temporary name first, so a sync app like OneDrive
//! never uploads a half-written backup under the real name.
//!
//! The settings live in a small JSON file next to the database, not inside it,
//! so restoring an old backup can't change where backups go.
//!
//! Restoring copies the chosen backup next to the database first (OneDrive
//! may only have it online), lets the frontend check that copy, saves the
//! current records as "TWIG before restore …", then swaps the copy in and
//! restarts TWIG, which runs any newer migrations on it.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

/// Development builds keep their backups apart from real ones, like their database.
const PREFIX: &str = if cfg!(debug_assertions) { "TWIG dev backup " } else { "TWIG backup " };
const CONFIG: &str = if cfg!(debug_assertions) { "backup-dev.json" } else { "backup.json" };
const DEFAULT_FOLDER: &str = if cfg!(debug_assertions) { "TWIG Backups (dev)" } else { "TWIG Backups" };
const BEFORE_RESTORE: &str = if cfg!(debug_assertions) { "TWIG dev before restore " } else { "TWIG before restore " };
const STAGING: &str = if cfg!(debug_assertions) { "restore-dev.db" } else { "restore.db" };

#[derive(Serialize, Deserialize, Clone)]
#[serde(default, rename_all = "camelCase")]
pub struct BackupSettings {
    enabled: bool,
    /// None means the default, Documents/TWIG Backups.
    folder: Option<String>,
    /// How many daily backups to keep; older ones are deleted.
    keep: usize,
    /// Local date (YYYY-MM-DD) of the last backup that worked.
    last_date: Option<String>,
    last_file: Option<String>,
    /// Why the last backup failed; cleared by the next one that works.
    last_error: Option<String>,
}

impl Default for BackupSettings {
    fn default() -> Self {
        Self { enabled: false, folder: None, keep: 14, last_date: None, last_file: None, last_error: None }
    }
}

/// The settings plus the folder they resolve to, for the Settings page.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupStatus {
    #[serde(flatten)]
    settings: BackupSettings,
    folder_path: String,
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_config_dir().map_err(|e| e.to_string())?.join(CONFIG))
}

fn load(app: &AppHandle) -> BackupSettings {
    config_path(app)
        .ok()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save(app: &AppHandle, s: &BackupSettings) -> Result<(), String> {
    let path = config_path(app)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    fs::write(path, serde_json::to_string_pretty(s).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

fn folder(app: &AppHandle, s: &BackupSettings) -> Result<PathBuf, String> {
    match &s.folder {
        Some(f) => Ok(PathBuf::from(f)),
        None => Ok(app.path().document_dir().map_err(|e| e.to_string())?.join(DEFAULT_FOLDER)),
    }
}

fn status(app: &AppHandle, settings: BackupSettings) -> Result<BackupStatus, String> {
    let folder_path = folder(app, &settings)?.to_string_lossy().into_owned();
    Ok(BackupStatus { settings, folder_path })
}

fn temp_path(app: &AppHandle, s: &BackupSettings) -> Result<PathBuf, String> {
    Ok(folder(app, s)?.join(format!("{PREFIX}in progress.tmp")))
}

/// Backup file names to delete so only the newest `keep` stay. Only names
/// TWIG wrote (prefix + date + .db) are ever touched.
fn to_prune(names: &[String], keep: usize) -> Vec<String> {
    let mut ours: Vec<&String> = names
        .iter()
        .filter(|n| {
            n.strip_prefix(PREFIX)
                .and_then(|rest| rest.strip_suffix(".db"))
                .is_some_and(|date| date.len() == 10 && date.chars().all(|c| c.is_ascii_digit() || c == '-'))
        })
        .collect();
    // YYYY-MM-DD sorts by date; newest first.
    ours.sort_by(|a, b| b.cmp(a));
    ours.into_iter().skip(keep.max(1)).cloned().collect()
}

#[tauri::command]
pub fn backup_status(app: AppHandle) -> Result<BackupStatus, String> {
    status(&app, load(&app))
}

#[tauri::command]
pub fn set_backup_settings(
    app: AppHandle,
    enabled: bool,
    folder: Option<String>,
    keep: usize,
) -> Result<BackupStatus, String> {
    let mut s = load(&app);
    s.enabled = enabled;
    s.folder = folder.filter(|f| !f.trim().is_empty());
    s.keep = keep.max(1);
    save(&app, &s)?;
    status(&app, s)
}

/// Makes sure the folder exists and returns the temporary path to write the copy to.
#[tauri::command]
pub fn backup_begin(app: AppHandle) -> Result<String, String> {
    let mut s = load(&app);
    let prepare = || -> Result<PathBuf, String> {
        let dir = folder(&app, &s)?;
        fs::create_dir_all(&dir).map_err(|_| {
            format!(
                "Can't reach the backup folder {}. If it's on a USB drive, plug it in, or choose another folder.",
                dir.display()
            )
        })?;
        let temp = temp_path(&app, &s)?;
        // VACUUM INTO won't write over a file; this one is left from a backup that was cut short.
        if temp.exists() {
            fs::remove_file(&temp).map_err(|e| e.to_string())?;
        }
        Ok(temp)
    };
    match prepare() {
        Ok(temp) => Ok(temp.to_string_lossy().into_owned()),
        Err(e) => {
            s.last_error = Some(e.clone());
            save(&app, &s)?;
            Err(e)
        }
    }
}

/// Moves the finished copy into place as "TWIG backup <date>.db", replacing one
/// from earlier the same day, then deletes the oldest beyond `keep`. With an
/// `error`, records it and cleans up instead.
#[tauri::command]
pub fn backup_finish(app: AppHandle, date: String, error: Option<String>) -> Result<BackupStatus, String> {
    let mut s = load(&app);
    let temp = temp_path(&app, &s)?;
    let finish = || -> Result<String, String> {
        if let Some(e) = &error {
            return Err(e.clone());
        }
        let dir = folder(&app, &s)?;
        let name = format!("{PREFIX}{date}.db");
        fs::rename(&temp, dir.join(&name)).map_err(|e| format!("Couldn't save the backup: {e}"))?;
        let names: Vec<String> = fs::read_dir(&dir)
            .map_err(|e| e.to_string())?
            .filter_map(|e| e.ok()?.file_name().into_string().ok())
            .collect();
        for old in to_prune(&names, s.keep) {
            // A backup that can't be deleted now is tried again next time.
            let _ = fs::remove_file(dir.join(old));
        }
        Ok(name)
    };
    match finish() {
        Ok(name) => {
            s.last_date = Some(date);
            s.last_file = Some(name);
            s.last_error = None;
        }
        Err(e) => {
            let _ = fs::remove_file(&temp);
            s.last_error = Some(e);
        }
    }
    save(&app, &s)?;
    status(&app, s)
}

#[tauri::command]
pub fn open_backup_folder(app: AppHandle) -> Result<(), String> {
    let dir = folder(&app, &load(&app))?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    app.opener().open_path(dir.to_string_lossy(), None::<&str>).map_err(|e| e.to_string())
}

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_config_dir().map_err(|e| e.to_string())
}

/// The database file and the -wal/-shm files SQLite keeps beside it.
fn with_sidecars(db: &Path) -> [PathBuf; 3] {
    let side = |ext: &str| PathBuf::from(format!("{}-{ext}", db.display()));
    [db.to_path_buf(), side("wal"), side("shm")]
}

fn remove_sidecars(db: &Path) -> Result<(), String> {
    for p in &with_sidecars(db)[1..] {
        if p.exists() {
            fs::remove_file(p).map_err(|e| format!("Couldn't remove {}: {e}", p.display()))?;
        }
    }
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Staged {
    /// For Database.load in the frontend.
    url: String,
    /// The newest migration this TWIG knows; a backup past it came from a newer TWIG.
    latest_version: i64,
}

/// Copies the chosen backup next to the database, ready to be checked.
#[tauri::command]
pub fn restore_stage(app: AppHandle, from: String) -> Result<Staged, String> {
    let staging = config_dir(&app)?.join(STAGING);
    for p in with_sidecars(&staging) {
        if p.exists() {
            fs::remove_file(&p).map_err(|e| e.to_string())?;
        }
    }
    fs::copy(&from, &staging).map_err(|e| format!("Couldn't read the backup: {e}"))?;
    Ok(Staged {
        url: format!("sqlite:{}", staging.display()),
        latest_version: crate::migrations().iter().map(|m| m.version).max().unwrap_or(0),
    })
}

/// Where to save the current records before a restore replaces them.
#[tauri::command]
pub fn restore_safety_path(app: AppHandle, stamp: String) -> Result<String, String> {
    let dir = folder(&app, &load(&app))?;
    fs::create_dir_all(&dir).map_err(|_| format!("Can't reach the backup folder {}.", dir.display()))?;
    let path = dir.join(format!("{BEFORE_RESTORE}{stamp}.db"));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(path.to_string_lossy().into_owned())
}

/// Swaps the checked copy in for the database and restarts TWIG. The frontend
/// closes its connections first, so nothing has the files open.
#[tauri::command]
pub fn restore_apply(app: AppHandle) -> Result<(), String> {
    let dir = config_dir(&app)?;
    let staging = dir.join(STAGING);
    let live = dir.join(crate::DB_URL.trim_start_matches("sqlite:"));
    if !staging.exists() {
        return Err("The backup to restore is missing; try again.".into());
    }
    remove_sidecars(&staging)?;
    // A -wal left beside the live file would be replayed onto the restored one.
    remove_sidecars(&live)?;
    fs::rename(&staging, &live).map_err(|e| format!("Couldn't restore the backup: {e}"))?;
    app.restart()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(dates: &[&str]) -> Vec<String> {
        dates.iter().map(|d| format!("{PREFIX}{d}.db")).collect()
    }

    #[test]
    fn prunes_oldest_beyond_keep() {
        let all = names(&["2026-11-01", "2026-10-30", "2026-11-02", "2026-10-31"]);
        assert_eq!(to_prune(&all, 2), names(&["2026-10-31", "2026-10-30"]));
        assert!(to_prune(&all, 14).is_empty());
    }

    #[test]
    fn never_prunes_other_files() {
        let mut all = names(&["2026-11-01", "2026-11-02"]);
        all.push("notes.docx".into());
        all.push(format!("{PREFIX}2026-11-02 copy.db"));
        all.push(format!("{PREFIX}in progress.tmp"));
        assert_eq!(to_prune(&all, 1), names(&["2026-11-01"]));
    }
}
