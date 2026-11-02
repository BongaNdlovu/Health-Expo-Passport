package org.newstart.expopassport;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

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

    /* kept until printing has its document, or Android may discard the page while it is being laid out. Only touched on
       the UI thread; while it is set, a card is being prepared and a second print is refused. */
    private WebView printView;
    private static final long PRINT_TIMEOUT_MS = 15000;

    @PluginMethod
    public void print(PluginCall call) {
        String html = call.getString("html");
        if (html == null || html.isEmpty()) {
            call.reject("No card to print");
            return;
        }
        String name = call.getString("name", "Health Expo card");

        getActivity().runOnUiThread(() -> {
            if (printView != null) {
                call.reject("A card is already being prepared for printing");
                return;
            }
            WebView view = new WebView(getContext());
            printView = view;
            /* the call is answered once: by the finished page, or by the timeout if the page never finishes */
            final boolean[] answered = {false};
            final android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
            final Runnable timeout = () -> {
                if (answered[0]) return;
                answered[0] = true;
                if (printView == view) printView = null;
                view.stopLoading();
                call.reject("The card did not finish loading. Try printing again.");
            };
            handler.postDelayed(timeout, PRINT_TIMEOUT_MS);
            view.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView v, String url) {
                    if (answered[0]) return;
                    answered[0] = true;
                    handler.removeCallbacks(timeout);
                    if (printView == view) printView = null;
                    PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                    if (manager == null) {
                        call.reject("This phone has no print service");
                        return;
                    }
                    PrintAttributes a6 = new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A6)
                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                        .build();
                    manager.print(name, v.createPrintDocumentAdapter(name), a6);
                    call.resolve();
                }
            });
            view.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        });
    }

    /**
     * Saves an export (the CSV/XLSX files). The WebView ignores a blob link's download, so the page hands the data over.
     * v1.6.2 (F-01 security fix): the file is written only to this app's private cache (cache/shared/) and offered
     * through the system share sheet with a one-off read grant (see SecureExport). Nothing goes to the public
     * Downloads folder or other shared storage any more, so visitor health data is never left readable by other apps.
     * Text arrives as "text"; binary files (XLSX) arrive base64-encoded with a "b64:" prefix.
     */
    @PluginMethod
    public void saveDownload(PluginCall call) {
        SecureExport.save(getContext(), getActivity(), call);
    }
}
