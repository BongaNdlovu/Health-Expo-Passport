package org.newstart.expopassport;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Prints the take-home card. An Android app has no window.print(), so the page hands over the card's HTML and this
 * plugin prints it through the phone's own print service on an A6 page (the dialog also offers "Save as PDF").
 * Works with no internet: the card, its styles and its QR code all arrive inside the HTML.
 */
@CapacitorPlugin(name = "CardPrinter")
public class CardPrinterPlugin extends Plugin {

    /* kept until printing has its document, or Android may discard the page while it is being laid out */
    private WebView printView;

    @PluginMethod
    public void print(PluginCall call) {
        String html = call.getString("html");
        if (html == null || html.isEmpty()) {
            call.reject("No card to print");
            return;
        }
        String name = call.getString("name", "Health Expo card");

        getActivity().runOnUiThread(() -> {
            WebView view = new WebView(getContext());
            printView = view;
            view.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView v, String url) {
                    PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                    if (manager == null) {
                        call.reject("This phone has no print service");
                        printView = null;
                        return;
                    }
                    PrintAttributes a6 = new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A6)
                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                        .build();
                    manager.print(name, v.createPrintDocumentAdapter(name), a6);
                    printView = null;
                    call.resolve();
                }
            });
            view.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        });
    }

    /**
     * Saves a text file (the CSV exports) where the person can find it. The WebView ignores a blob link's download, so
     * the page hands the text over. Android 10 and later: the public Downloads folder, through MediaStore, with no
     * storage permission. Older phones: this app's own Downloads folder (Android/data/…/files/Download).
     */
    @PluginMethod
    public void saveDownload(PluginCall call) {
        String name = call.getString("name");
        String text = call.getString("text");
        if (name == null || name.isEmpty() || text == null) {
            call.reject("Nothing to save");
            return;
        }
        String mime = call.getString("mime", "text/csv");
        byte[] bytes = text.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        try {
            JSObject out = new JSObject();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, name);
                values.put(MediaStore.Downloads.MIME_TYPE, mime);
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    call.reject("Downloads could not be opened");
                    return;
                }
                try (java.io.OutputStream os = resolver.openOutputStream(uri)) {
                    if (os == null) throw new java.io.IOException("Downloads could not be written");
                    os.write(bytes);
                }
                out.put("where", "Downloads");
            } else {
                java.io.File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) {
                    call.reject("No storage available");
                    return;
                }
                java.io.File file = new java.io.File(dir, name);
                try (java.io.FileOutputStream os = new java.io.FileOutputStream(file)) {
                    os.write(bytes);
                }
                out.put("where", file.getAbsolutePath());
            }
            call.resolve(out);
        } catch (Exception e) {
            call.reject("Could not save the file: " + e.getMessage());
        }
    }
}
