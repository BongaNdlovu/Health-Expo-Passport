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
}
