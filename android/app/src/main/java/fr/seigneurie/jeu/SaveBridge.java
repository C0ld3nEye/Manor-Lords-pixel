package fr.seigneurie.jeu;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.webkit.JavascriptInterface;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Le pont entre le jeu et Android (window.SeigneurieAndroid dans la page).
 * Chaque emplacement de sauvegarde est un fichier de files/saves/ : écrit dans un fichier temporaire, puis mis à la
 * place de l'ancien, qui est gardé en .bak. Ces fichiers ne disparaissent qu'à la désinstallation et suivent la
 * sauvegarde automatique d'Android (voir res/xml).
 */
public class SaveBridge {
    private final Activity act;
    private final File dir;

    SaveBridge(Activity a) {
        act = a;
        dir = new File(a.getFilesDir(), "saves");
        if (!dir.exists()) dir.mkdirs();
    }

    private File fileFor(String key) {
        return new File(dir, key.replaceAll("[^A-Za-z0-9._-]", "_") + ".json");
    }

    @JavascriptInterface
    public synchronized boolean save(String key, String value) {
        if (key == null || value == null) return false;
        File f = fileFor(key);
        File tmp = new File(dir, f.getName() + ".tmp");
        File bak = new File(dir, f.getName() + ".bak");
        FileOutputStream out = null;
        try {
            out = new FileOutputStream(tmp);
            out.write(value.getBytes("UTF-8"));
            out.getFD().sync();
        } catch (IOException e) {
            tmp.delete();
            return false;
        } finally {
            if (out != null) try { out.close(); } catch (IOException e) { /* rien */ }
        }
        if (f.exists()) {
            bak.delete();
            f.renameTo(bak);
        }
        return tmp.renameTo(f);
    }

    @JavascriptInterface
    public synchronized String load(String key) {
        if (key == null) return null;
        File f = fileFor(key);
        String v = read(f);
        if (v == null) v = read(new File(dir, f.getName() + ".bak"));
        return v;
    }

    @JavascriptInterface
    public synchronized void remove(String key) {
        if (key == null) return;
        File f = fileFor(key);
        f.delete();
        new File(dir, f.getName() + ".bak").delete();
    }

    private static String read(File f) {
        if (!f.exists()) return null;
        FileInputStream in = null;
        try {
            in = new FileInputStream(f);
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[65536];
            int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            return b.toString("UTF-8");
        } catch (IOException e) {
            return null;
        } finally {
            if (in != null) try { in.close(); } catch (IOException e) { /* rien */ }
        }
    }

    /** Copie un texte (code de sauvegarde) dans le presse-papiers. */
    @JavascriptInterface
    public void copy(final String text) {
        act.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                ClipboardManager cm = (ClipboardManager) act.getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("Seigneurie", text));
            }
        });
    }

    /** Le texte du presse-papiers (pour importer un code copié ailleurs), ou null. */
    @JavascriptInterface
    public String paste() {
        try {
            ClipboardManager cm = (ClipboardManager) act.getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm == null || !cm.hasPrimaryClip()) return null;
            ClipData c = cm.getPrimaryClip();
            if (c == null || c.getItemCount() == 0) return null;
            CharSequence t = c.getItemAt(0).coerceToText(act);
            return t == null ? null : t.toString();
        } catch (Exception e) {
            return null;
        }
    }

    /** Ouvre le menu de partage d'Android (Drive, mail, notes…) avec un code de sauvegarde. */
    @JavascriptInterface
    public void share(final String text, final String subject) {
        act.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_SUBJECT, subject);
                send.putExtra(Intent.EXTRA_TEXT, text);
                try { act.startActivity(Intent.createChooser(send, "Garder la sauvegarde")); } catch (Exception e) { /* rien */ }
            }
        });
    }
}
