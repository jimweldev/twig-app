//! Saves the page as a PDF through WebView2, the way printing does, but without the
//! print window's header and footer (date, title, address, page number).

use std::sync::mpsc;

use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2Environment6, ICoreWebView2_7, COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT,
};
use webview2_com::PrintToPdfCompletedHandler;
use windows::core::{Interface, HSTRING};

/// Writes the page, as it prints, to `path`. Pages are `width_in` × `height_in` inches
/// with no margins; the page's own print CSS decides what is on them.
pub async fn save(webview: tauri::Webview, path: String, width_in: f64, height_in: f64) -> Result<(), String> {
    let (tx, rx) = mpsc::channel::<Result<(), String>>();
    webview
        .with_webview(move |platform| {
            let done = tx.clone();
            let started = (|| -> windows::core::Result<()> {
                unsafe {
                    let webview: ICoreWebView2_7 = platform.controller().CoreWebView2()?.cast()?;
                    let environment: ICoreWebView2Environment6 = platform.environment().cast()?;
                    let settings = environment.CreatePrintSettings()?;
                    settings.SetShouldPrintHeaderAndFooter(false)?;
                    settings.SetShouldPrintBackgrounds(true)?;
                    // Width and height already say landscape or portrait.
                    settings.SetOrientation(COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT)?;
                    settings.SetPageWidth(width_in)?;
                    settings.SetPageHeight(height_in)?;
                    settings.SetMarginTop(0.0)?;
                    settings.SetMarginBottom(0.0)?;
                    settings.SetMarginLeft(0.0)?;
                    settings.SetMarginRight(0.0)?;
                    let handler = PrintToPdfCompletedHandler::create(Box::new(move |result, saved| {
                        let _ = done.send(match result {
                            Ok(()) if saved => Ok(()),
                            Ok(()) => Err("The PDF couldn't be saved. Is the file open in another program?".into()),
                            Err(e) => Err(e.message()),
                        });
                        Ok(())
                    }));
                    webview.PrintToPdf(&HSTRING::from(path.as_str()), &settings, &handler)
                }
            })();
            if let Err(e) = started {
                let _ = tx.send(Err(e.message()));
            }
        })
        .map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        rx.recv().unwrap_or_else(|_| Err("The PDF couldn't be saved.".into()))
    })
    .await
    .map_err(|e| e.to_string())?
}
