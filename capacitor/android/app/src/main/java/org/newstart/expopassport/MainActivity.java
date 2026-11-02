package org.newstart.expopassport;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        /* the app's own plugin: prints the take-home card through the phone's print service (see CardPrinterPlugin) */
        registerPlugin(CardPrinterPlugin.class);
        /* v1.6.2 (F-02/F-06): hands the web layer its Android Keystore-wrapped key for encrypting saved data (see SecureKeyPlugin) */
        registerPlugin(SecureKeyPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
