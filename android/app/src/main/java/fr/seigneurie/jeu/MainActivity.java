package fr.seigneurie.jeu;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import android.view.Window;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * Seigneurie : le jeu (HTML/JS pur, dans les assets) affiché dans une vue web, hors-ligne.
 * Les parties sont gardées par le jeu dans le stockage local de la vue web ET, par le pont SaveBridge,
 * dans des fichiers de l'application (qui suivent la sauvegarde automatique d'Android).
 */
public class MainActivity extends Activity {
    private WebView web;
    private SaveBridge bridge;
    private String pendingExport = null;
    private static final int REQ_EXPORT = 41, REQ_IMPORT = 42;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(0x17, 0x12, 0x0d));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);           // le jeu a son propre réglage de taille du texte
        s.setSupportZoom(false);
        // les fenêtres de dialogue du jeu (coller un code de sauvegarde) ne s'affichent qu'avec un WebChromeClient
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("file".equals(u.getScheme())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* aucun navigateur */ }
                return true;
            }
        });
        bridge = new SaveBridge(this);
        web.addJavascriptInterface(bridge, "SeigneurieAndroid");
        setContentView(web);
        web.loadUrl("file:///android_asset/www/index.html");
    }

    /** Exporter : le sélecteur de documents d'Android (aucune permission nécessaire). */
    void askExport(String name, String content) {
        pendingExport = content;
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("application/json");
        i.putExtra(Intent.EXTRA_TITLE, name);
        try { startActivityForResult(i, REQ_EXPORT); } catch (Exception e) { pendingExport = null; notifyJs("export", false); }
    }

    void askImport() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        try { startActivityForResult(i, REQ_IMPORT); } catch (Exception e) { notifyJs("import", false); }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        Uri uri = (resultCode == RESULT_OK && data != null) ? data.getData() : null;
        if (requestCode == REQ_EXPORT) {
            boolean ok = false;
            if (uri != null && pendingExport != null) {
                OutputStream out = null;
                try {
                    out = getContentResolver().openOutputStream(uri, "wt");
                    if (out != null) { out.write(pendingExport.getBytes("UTF-8")); out.flush(); ok = true; }
                } catch (Exception e) {
                    ok = false;
                } finally {
                    if (out != null) try { out.close(); } catch (Exception e) { /* rien */ }
                }
            }
            pendingExport = null;
            notifyJs("export", ok);
        } else if (requestCode == REQ_IMPORT) {
            String text = null;
            if (uri != null) {
                InputStream in = null;
                try {
                    in = getContentResolver().openInputStream(uri);
                    if (in != null) {
                        ByteArrayOutputStream b = new ByteArrayOutputStream();
                        byte[] buf = new byte[65536];
                        int n;
                        while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
                        text = b.toString("UTF-8");
                    }
                } catch (Exception e) {
                    text = null;
                } finally {
                    if (in != null) try { in.close(); } catch (Exception e) { /* rien */ }
                }
            }
            bridge.setImport(text);
            notifyJs("import", text != null);
        } else super.onActivityResult(requestCode, resultCode, data);
    }

    private void notifyJs(String kind, boolean ok) {
        if (web != null) web.evaluateJavascript("window.seigneurieFileDone && window.seigneurieFileDone('" + kind + "', " + ok + ")", null);
    }

    /** Retour : le jeu ferme d'abord ce qui est ouvert ; il répond « quit » au second appui. */
    @Override
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript("window.seigneurieBack ? window.seigneurieBack() : 'quit'", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String v) {
                if (v == null || v.contains("quit")) finish();
            }
        });
    }

    /** L'application passe en arrière-plan : le jeu sauvegarde tout de suite. */
    @Override
    protected void onPause() {
        if (web != null) web.evaluateJavascript("window.seigneurieSave && window.seigneurieSave()", null);
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
