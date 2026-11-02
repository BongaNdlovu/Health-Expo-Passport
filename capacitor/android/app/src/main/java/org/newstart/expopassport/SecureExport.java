package org.newstart.expopassport;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/** F-01 fix: exports are written to app-private cache (cache/shared/, already declared in file_paths.xml)
 *  and handed to the user through the system share sheet with a one-off read grant.
 *  Nothing is written to shared/public storage (no MediaStore.Downloads, no external files dir). */
public final class SecureExport {
    static final String AUTHORITY = "org.newstart.expopassport.fileprovider";
    static final long MAX_AGE_MS = 60L * 60L * 1000L;
    private SecureExport() {}

    /** Keep only [A-Za-z0-9._-], no leading dot, max 80 chars; never lets a name escape the folder. */
    static String safeName(String name) {
        String n = name == null ? "" : name.replaceAll("[^A-Za-z0-9._-]", "_");
        while (n.startsWith(".")) n = n.substring(1);
        if (n.length() > 80) n = n.substring(n.length() - 80);
        return n.isEmpty() ? "export.csv" : n;
    }

    /** Deletes exports older than an hour (and is run on every export) so health data does not pile up. */
    static void sweep(File dir) {
        File[] old = dir.listFiles();
        if (old == null) return;
        long now = System.currentTimeMillis();
        for (File f : old) if (now - f.lastModified() > MAX_AGE_MS) f.delete();
    }

    static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    public static void save(Context ctx, Activity act, PluginCall call) {
        String name = call.getString("name");
        String text = call.getString("text");
        if (name == null || name.isEmpty() || text == null) { call.reject("Nothing to save"); return; }
        String mime = call.getString("mime", "text/csv");
        if (!"text/csv".equals(mime) && !XLSX.equals(mime)) mime = "text/plain";
        try {
            File dir = new File(ctx.getCacheDir(), "shared");
            if (!dir.isDirectory() && !dir.mkdirs()) throw new java.io.IOException("cache not writable");
            sweep(dir);
            File out = new File(dir, safeName(name));
            if (!out.getCanonicalPath().startsWith(dir.getCanonicalPath() + File.separator)) throw new SecurityException("bad name");
            try (FileOutputStream os = new FileOutputStream(out)) { os.write(text.startsWith("b64:") ? android.util.Base64.decode(text.substring(4), android.util.Base64.DEFAULT) : text.getBytes(StandardCharsets.UTF_8)); }
            Uri uri = FileProvider.getUriForFile(ctx, AUTHORITY, out);
            Intent send = new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, "Send " + out.getName());
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            act.startActivity(chooser);
            JSObject r = new JSObject();
            r.put("where", "share sheet");
            r.put("private", true);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Could not prepare the file: " + e.getMessage());
        }
    }
}
