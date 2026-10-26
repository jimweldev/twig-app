use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

/// Development builds (`tauri dev`) use their own database so testing never
/// touches real class records. Both live in the app data folder.
pub const DB_URL: &str = if cfg!(debug_assertions) {
    "sqlite:twig-dev.db"
} else {
    "sqlite:twig.db"
};

/// Migration SQL with Windows line endings turned into `\n`. sqlx stores a
/// checksum of each migration's exact text, so a file checked out with CRLF
/// (git on Windows) would otherwise look "modified" next to one applied with LF.
fn lf(sql: &'static str) -> &'static str {
    if sql.contains('\r') {
        // Runs once per migration at startup; leaking keeps the &'static str sqlx needs.
        Box::leak(sql.replace("\r\n", "\n").into_boxed_str())
    } else {
        sql
    }
}

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init_ecr",
            sql: lf(include_str!("../migrations/001_init.sql")),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "school_years_sections",
            sql: lf(include_str!("../migrations/002_school_years_sections.sql")),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "section_learners",
            sql: lf(include_str!("../migrations/003_section_learners.sql")),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "received_grades",
            sql: lf(include_str!("../migrations/004_received_grades.sql")),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "advisory_section",
            sql: lf(include_str!("../migrations/005_advisory_section.sql")),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "report_cards",
            sql: lf(include_str!("../migrations/006_report_cards.sql")),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "attendance",
            sql: lf(include_str!("../migrations/007_attendance.sql")),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "birthdate_observed_values",
            sql: lf(include_str!("../migrations/008_birthdate_observed_values.sql")),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "all_grade_levels",
            sql: lf(include_str!("../migrations/009_all_grade_levels.sql")),
            kind: MigrationKind::Up,
        },
    ]
}

/// Swaps the splash window for the main window, which starts hidden and
/// maximized so the user never sees an empty white page.
fn show_main(app: &AppHandle) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.maximize();
        let _ = main.show();
        let _ = main.set_focus();
    }
    if let Some(splash) = app.get_webview_window("splashscreen") {
        let _ = splash.close();
    }
}

/// The database the frontend should open; the same one migrations run on.
#[tauri::command]
fn db_url() -> &'static str {
    DB_URL
}

/// Called by the frontend once its first data has loaded.
#[tauri::command]
fn app_ready(app: AppHandle) {
    show_main(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Fallback: never leave the user on the splash if the frontend fails to report ready.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_secs(15));
                show_main(&handle);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![app_ready, db_url])
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_checksum_the_same_with_crlf_or_lf() {
        assert_eq!(lf("CREATE TABLE a (x);\r\nCREATE TABLE b (y);\r\n"), "CREATE TABLE a (x);\nCREATE TABLE b (y);\n");
        assert_eq!(lf("SELECT 1;\n"), "SELECT 1;\n");
        assert!(migrations().iter().all(|m| !m.sql.contains('\r')));
    }
}
