//! Saves the page as a PDF through WKWebView's print operation, the way printing does,
//! but straight to a file: no print panel, and no header or footer.

use std::sync::mpsc;

use objc2::sel;
use objc2_app_kit::{NSPrintInfo, NSPrintJobSavingURL, NSPrintSaveJob, NSPrintingPaginationMode};
use objc2_foundation::{NSCopying, NSObjectProtocol, NSSize, NSString, NSURL};
use objc2_web_kit::WKWebView;

/// Points per inch, the unit AppKit measures paper in.
const PT: f64 = 72.0;

/// Writes the page, as it prints, to `path`. Pages are `width_in` × `height_in` inches
/// with `margin_in` on every side; the page's own print CSS decides what is on them.
pub async fn save(
    webview: tauri::Webview,
    path: String,
    width_in: f64,
    height_in: f64,
    margin_in: f64,
) -> Result<(), String> {
    let (tx, rx) = mpsc::channel::<Result<(), String>>();
    webview
        .with_webview(move |platform| {
            // Runs on the main thread, where AppKit wants printing done.
            let webview: &WKWebView = unsafe { &*(platform.inner() as *const WKWebView) };
            let _ = tx.send(unsafe { print_to_file(webview, &path, width_in, height_in, margin_in) });
        })
        .map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        rx.recv().unwrap_or_else(|_| Err("The PDF couldn't be saved.".into()))
    })
    .await
    .map_err(|e| e.to_string())?
}

unsafe fn print_to_file(
    webview: &WKWebView,
    path: &str,
    width_in: f64,
    height_in: f64,
    margin_in: f64,
) -> Result<(), String> {
    unsafe {
        // printOperationWithPrintInfo: needs macOS 11.
        if !webview.respondsToSelector(sel!(printOperationWithPrintInfo:)) {
            return Err("Saving as PDF needs macOS 11 or later.".into());
        }

        // Colored cells and shaded headers; WebKit leaves backgrounds out by default (macOS 13.3+).
        let preferences = webview.configuration().preferences();
        if preferences.respondsToSelector(sel!(setShouldPrintBackgrounds:)) {
            preferences.setShouldPrintBackgrounds(true);
        }

        let info = NSPrintInfo::sharedPrintInfo().copy();
        info.setJobDisposition(NSPrintSaveJob);
        info.dictionary()
            .insert(NSPrintJobSavingURL, &NSURL::fileURLWithPath(&NSString::from_str(path)));
        info.setPaperSize(NSSize::new(width_in * PT, height_in * PT));
        info.setTopMargin(margin_in * PT);
        info.setBottomMargin(margin_in * PT);
        info.setLeftMargin(margin_in * PT);
        info.setRightMargin(margin_in * PT);
        info.setHorizontalPagination(NSPrintingPaginationMode::Fit);
        info.setVerticalPagination(NSPrintingPaginationMode::Automatic);
        info.setHorizontallyCentered(false);
        info.setVerticallyCentered(false);

        let operation = webview.printOperationWithPrintInfo(&info);
        operation.setShowsPrintPanel(false);
        operation.setShowsProgressPanel(false);
        // Without a frame the print view lays out at zero size and the pages come out blank.
        if let Some(view) = operation.view() {
            view.setFrame(webview.bounds());
        }
        if operation.runOperation() {
            Ok(())
        } else {
            Err("The PDF couldn't be saved. Is the file open in another program?".into())
        }
    }
}
