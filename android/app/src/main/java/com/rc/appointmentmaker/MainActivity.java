package com.rc.appointmentmaker;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.InputStream;
import com.getcapacitor.BridgeActivity;
import com.lepisode.capacitor.googlelogin.CapacitorGoogleLoginPlugin;
import com.capacitorjs.plugins.filesystem.FilesystemPlugin;
import com.capacitorjs.plugins.share.SharePlugin;
import getcapacitor.community.contacts.ContactsPlugin;
import dev.barooni.capacitor.calendar.CapacitorCalendarPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register plugins before super.onCreate to ensure they are available at bridge initialization
        registerPlugin(CapacitorGoogleLoginPlugin.class);
        registerPlugin(FilesystemPlugin.class);
        registerPlugin(SharePlugin.class);
        registerPlugin(ContactsPlugin.class);
        registerPlugin(CapacitorCalendarPlugin.class);
        
        super.onCreate(savedInstanceState);

        getBridge().getWebView().setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                String path = request.getUrl().getPath();
                if (path == null) return super.shouldInterceptRequest(view, request);
                boolean isJs = url.endsWith(".js") || url.endsWith("app.js") || path.contains("/firebase/");
                if (isJs) {
                    String assetPath;
                    if (path.startsWith("/android_asset/public/")) {
                        assetPath = path.substring("/android_asset/public/".length());
                    } else {
                        assetPath = path.startsWith("/") ? path.substring(1) : path;
                    }
                    try {
                        InputStream stream = getAssets().open(assetPath);
                        return new WebResourceResponse("application/javascript", "UTF-8", stream);
                    } catch (Exception e) {
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }
        });
    }
}
