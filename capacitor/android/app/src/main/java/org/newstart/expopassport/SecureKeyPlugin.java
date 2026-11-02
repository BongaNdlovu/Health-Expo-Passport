package org.newstart.expopassport;

import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.KeyStore;
import java.security.SecureRandom;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** F-02/F-06 fix: provides the AES-256 data key used by the web layer to encrypt localStorage.
 *  The data key is stored only wrapped (AES-GCM) by a non-exportable Android Keystore key. */
@CapacitorPlugin(name = "SecureKey")
public class SecureKeyPlugin extends Plugin {
    private static final String KS = "AndroidKeyStore", ALIAS = "newstart.storage.wrap.v1", PREFS = "newstart.securekey", ENTRY = "dk.v1";

    private SecretKey wrapKey() throws Exception {
        KeyStore ks = KeyStore.getInstance(KS);
        ks.load(null);
        if (ks.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KS);
        kg.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build());
        return kg.generateKey();
    }

    @PluginMethod
    public synchronized void getKey(PluginCall call) {
        try {
            SecretKey wk = wrapKey();
            SharedPreferences sp = getContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE);
            String stored = sp.getString(ENTRY, null);
            byte[] dk;
            if (stored != null) {
                byte[] blob = Base64.decode(stored, Base64.NO_WRAP);
                Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
                c.init(Cipher.DECRYPT_MODE, wk, new GCMParameterSpec(128, blob, 0, 12));
                dk = c.doFinal(blob, 12, blob.length - 12);
            } else {
                dk = new byte[32];
                new SecureRandom().nextBytes(dk);
                Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
                c.init(Cipher.ENCRYPT_MODE, wk);
                byte[] iv = c.getIV(), ct = c.doFinal(dk), blob = new byte[iv.length + ct.length];
                System.arraycopy(iv, 0, blob, 0, iv.length);
                System.arraycopy(ct, 0, blob, iv.length, ct.length);
                if (!sp.edit().putString(ENTRY, Base64.encodeToString(blob, Base64.NO_WRAP)).commit()) throw new IllegalStateException("key not saved");
            }
            JSObject r = new JSObject();
            r.put("key", Base64.encodeToString(dk, Base64.NO_WRAP));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Secure key unavailable: " + e.getClass().getSimpleName());
        }
    }
}
