package com.grupopixel.pandanet;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Solicita a permissão de microfone em tempo de execução caso ainda não tenha sido concedida
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                new String[]{ Manifest.permission.RECORD_AUDIO }, 1001);
        }

        WebView webView = (WebView) this.bridge.getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            // Permite reprodução automática de áudios (notificações, etc.)
            settings.setMediaPlaybackRequiresUserGesture(false);

            // Salva o WebChromeClient original do Capacitor para delegar outros eventos
            final WebChromeClient bridgeClient = webView.getWebChromeClient();

            webView.setWebChromeClient(new WebChromeClient() {
                /**
                 * Concede permissões de mídia (microfone, câmera) à WebView quando
                 * as permissões Android já foram concedidas pelo usuário.
                 * Sem esse override, o getUserMedia() falha mesmo com permissões concedidas.
                 */
                @Override
                public void onPermissionRequest(final PermissionRequest request) {
                    runOnUiThread(() -> {
                        // Concede todos os recursos solicitados (microfone, câmera, etc.)
                        request.grant(request.getResources());
                    });
                }

                // Delega a escolha de arquivo para o Capacitor (necessário para upload de imagens/docs)
                @Override
                public boolean onShowFileChooser(
                        WebView wv,
                        android.webkit.ValueCallback<android.net.Uri[]> filePathCallback,
                        FileChooserParams fileChooserParams) {
                    if (bridgeClient != null) {
                        return bridgeClient.onShowFileChooser(wv, filePathCallback, fileChooserParams);
                    }
                    return false;
                }

                @Override
                public void onShowCustomView(android.view.View view, CustomViewCallback callback) {
                    if (bridgeClient != null) {
                        bridgeClient.onShowCustomView(view, callback);
                    }
                }

                @Override
                public void onHideCustomView() {
                    if (bridgeClient != null) {
                        bridgeClient.onHideCustomView();
                    }
                }

                @Override
                public void onProgressChanged(WebView view, int newProgress) {
                    if (bridgeClient != null) {
                        bridgeClient.onProgressChanged(view, newProgress);
                    }
                }
            });

            // Intercepta solicitações de download na WebView e abre no navegador do sistema Android
            webView.setDownloadListener(new android.webkit.DownloadListener() {
                @Override
                public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                    try {
                        android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_VIEW);
                        intent.setData(android.net.Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            });
        }
    }
}
