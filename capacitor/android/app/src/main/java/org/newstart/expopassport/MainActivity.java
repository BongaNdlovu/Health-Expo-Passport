package org.newstart.expopassport;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        /* the app's own plugin: prints the take-home card through the phone's print service (see CardPrinterPlugin) */
        registerPlugin(CardPrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
