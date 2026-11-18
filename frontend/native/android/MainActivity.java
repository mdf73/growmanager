package com.growmanager.app;

import android.os.Bundle;
import android.view.ViewGroup.MarginLayoutParams;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Copiée dans android/ par la CI (android-apk.yml) après "npx cap add android".
 *
 * En bord à bord (targetSdk 36), Android ne redimensionne plus la fenêtre quand
 * le clavier s'ouvre (adjustResize ignoré). Capacitor ("adjustMarginsForEdgeToEdge:
 * force") ne compense que les barres système : le clavier recouvre donc la WebView.
 * On remplace son listener par un équivalent qui prend aussi en compte le clavier
 * (inset IME) : la WebView rétrécit, la page voit sa hauteur diminuer et le champ
 * actif peut remonter au-dessus du clavier.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());

            MarginLayoutParams mlp = (MarginLayoutParams) v.getLayoutParams();
            mlp.leftMargin = bars.left;
            mlp.topMargin = bars.top;
            mlp.rightMargin = bars.right;
            mlp.bottomMargin = Math.max(bars.bottom, ime.bottom);
            v.setLayoutParams(mlp);

            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(webView);
    }
}
