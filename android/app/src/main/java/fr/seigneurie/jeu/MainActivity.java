package fr.seigneurie.jeu;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
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
        web.addJavascriptInterface(new SaveBridge(this), "SeigneurieAndroid");
        setContentView(web);
        web.loadUrl("file:///android_asset/www/index.html");
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
