package com.nyaarank;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.Socket;
import java.net.URL;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.security.cert.Certificate;
import java.security.cert.X509Certificate;
import java.util.Collection;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SNIHostName;
import javax.net.ssl.SNIServerName;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSession;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;

/**
 * Hosts the web app from assets/ in a WebView.
 *
 * The whole reason this app exists: nyaa.si sends no CORS headers, so a browser
 * cannot fetch it and the web build has to bounce through free public relays
 * that break constantly. Here the HTTP happens in Java, where CORS does not apply.
 * TorBox is called the same way, which also keeps the API token out of JS-visible
 * network state.
 *
 * Bridge contract (must match app.js):
 *
 *   Nyaa.request(specJson, token)   spec = {method, url, headers:{}, body:{...}}
 *     -> window.__nyaaResolve(token, payload)
 *        payload is JSON {"status":int,"body":string} on any HTTP reply,
 *        including 4xx/5xx (TorBox returns 400 for "device code not used yet",
 *        so non-2xx is data, not failure)
 *        payload is "ERROR:<message>" only for transport failures
 *
 *   Nyaa.getKey() / Nyaa.setKey(k)  TorBox token, SharedPreferences
 *   Nyaa.openUrl(url)               hand a URL to the system browser
 *   Nyaa.download(url, filename)    hand a CDN link to DownloadManager
 *
 * Async on purpose: @JavascriptInterface methods run on the JavaBridge thread,
 * so blocking there freezes the page and the spinner stops animating.
 *
 * NOTHING HERE MAY LOG A URL. TorBox's requestdl carries the API token in the
 * query string, so URLs are secrets.
 */
public class MainActivity extends Activity {

    private static final String ENTRY = "file:///android_asset/index.html";
    private static final int TIMEOUT_MS = 20000;
    private static final String PREFS = "nyaarank";
    private static final String KEY_TOKEN = "torbox_token";

    private WebView web;
    private SharedPreferences prefs;
    private final ExecutorService pool = Executors.newFixedThreadPool(3);

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        web = new WebView(this);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                return handleUrl(req.getUrl());
            }
        });

        web.addJavascriptInterface(new Bridge(), "Nyaa");

        setContentView(web);
        web.loadUrl(ENTRY);
    }

    /**
     * Magnet links and any other external scheme hand off to another app
     * instead of the copy-paste dance. Returning true means "I handled it".
     */
    private boolean handleUrl(Uri uri) {
        String scheme = uri.getScheme();
        if (scheme == null) return false;
        if (scheme.equals("file")) return false;  // our own pages, let them load
        return openExternal(uri);
    }

    private boolean openExternal(Uri uri) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, uri);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            final String scheme = uri.getScheme();
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(MainActivity.this,
                            "No app installed to open " + scheme + " links",
                            Toast.LENGTH_LONG).show();
                }
            });
        }
        return true;
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        pool.shutdownNow();
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    // ---------------------------------------------------------------- bridge

    private class Bridge {

        @JavascriptInterface
        public void request(final String specJson, final String token) {
            pool.execute(new Runnable() {
                @Override
                public void run() {
                    String payload;
                    try {
                        payload = execute(new JSONObject(specJson));
                    } catch (Exception e) {
                        payload = "ERROR:" + describe(e);
                    }
                    resolve(token, payload);
                }
            });
        }

        @JavascriptInterface
        public String getKey() {
            return prefs.getString(KEY_TOKEN, "");
        }

        @JavascriptInterface
        public void setKey(String k) {
            SharedPreferences.Editor e = prefs.edit();
            if (k == null || k.isEmpty()) e.remove(KEY_TOKEN);
            else e.putString(KEY_TOKEN, k);
            e.apply();
        }

        @JavascriptInterface
        public void openUrl(String url) {
            try {
                openExternal(Uri.parse(url));
            } catch (Exception ignored) {
                // malformed URL from the page; nothing useful to do
            }
        }

        @JavascriptInterface
        public void download(String url, String filename) {
            try {
                String name = safeName(filename);
                DownloadManager.Request r =
                        new DownloadManager.Request(Uri.parse(url));
                r.setTitle(name);
                r.setDescription("nyaarank");
                r.setNotificationVisibility(
                        DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                r.setDestinationInExternalPublicDir(
                        Environment.DIRECTORY_DOWNLOADS, name);
                DownloadManager dm =
                        (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm != null) dm.enqueue(r);
            } catch (final Exception e) {
                final String m = describe(e);
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(MainActivity.this,
                                "Download failed to start: " + m,
                                Toast.LENGTH_LONG).show();
                    }
                });
            }
        }
    }

    /** Hand the result back to JS on the UI thread. */
    private void resolve(final String token, final String payload) {
        final WebView v = web;
        if (v == null) return;
        v.post(new Runnable() {
            @Override
            public void run() {
                if (web == null) return;
                String js = "window.__nyaaResolve("
                        + JSONObject.quote(token) + ","
                        + JSONObject.quote(payload) + ")";
                web.evaluateJavascript(js, null);
            }
        });
    }

    // ----------------------------------------------------------------- http

    /**
     * Performs one HTTP request described by spec and returns
     * {"status":int,"body":string} as a JSON string.
     */
    private static String execute(JSONObject spec) throws Exception {
        URL url = new URL(spec.getString("url"));
        try {
            return attempt(spec, url, null);
        } catch (IOException transportFail) {
            // Indonesian ISPs block both nyaa.si and api.torbox.app at DNS, but
            // in two different ways: a carrier may return NXDOMAIN (throws
            // UnknownHostException) while Biznet answers with a poisoned IP
            // (rpz.biznet) that then fails at TLS instead. Catch both shapes,
            // resolve over DoH, and reconnect by IP with the real hostname in
            // SNI. Verified against the live hosts: neither is SNI-filtered —
            // only the DNS answer is tampered with.
            String ip;
            try {
                ip = dohResolve(url.getHost());
            } catch (Exception dohFail) {
                throw transportFail;   // report the real failure, not ours
            }
            return attempt(spec, url, ip);
        }
    }

    private static String attempt(JSONObject spec, URL url, String ip) throws Exception {
        String method = spec.optString("method", "GET").toUpperCase();

        HttpURLConnection c = (ip == null)
                ? (HttpURLConnection) url.openConnection()
                : openByIp(url, ip);
        try {
            c.setRequestMethod(method);
            c.setConnectTimeout(TIMEOUT_MS);
            c.setReadTimeout(TIMEOUT_MS);
            c.setInstanceFollowRedirects(true);
            c.setRequestProperty("User-Agent",
                    "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 nyaarank/1.0");
            c.setRequestProperty("Accept", "application/json, application/xml, text/xml, */*");

            JSONObject headers = spec.optJSONObject("headers");
            if (headers != null) {
                Iterator<String> it = headers.keys();
                while (it.hasNext()) {
                    String k = it.next();
                    c.setRequestProperty(k, headers.getString(k));
                }
            }

            JSONObject body = spec.optJSONObject("body");
            if (body != null && !method.equals("GET") && !method.equals("HEAD")) {
                writeBody(c, body);
            }

            int code = c.getResponseCode();
            InputStream in = (code >= 400) ? c.getErrorStream() : c.getInputStream();

            String text = "";
            if (in != null) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n;
                try {
                    while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
                } finally {
                    in.close();
                }
                text = out.toString("UTF-8");
            }

            JSONObject res = new JSONObject();
            res.put("status", code);
            res.put("body", text);
            return res.toString();
        } finally {
            c.disconnect();
        }
    }

    /** kind: "json" | "form" | "multipart" | "raw" */
    private static void writeBody(HttpURLConnection c, JSONObject body) throws Exception {
        String kind = body.optString("kind", "json");
        byte[] payload;

        if (kind.equals("multipart")) {
            String boundary = "----nyaarank" + System.currentTimeMillis();
            c.setRequestProperty("Content-Type",
                    "multipart/form-data; boundary=" + boundary);
            payload = multipart(body.optJSONObject("data"), boundary);
        } else if (kind.equals("form")) {
            c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
            payload = urlEncoded(body.optJSONObject("data"))
                    .getBytes(StandardCharsets.UTF_8);
        } else if (kind.equals("raw")) {
            c.setRequestProperty("Content-Type",
                    body.optString("contentType", "text/plain"));
            payload = body.optString("text", "").getBytes(StandardCharsets.UTF_8);
        } else {
            c.setRequestProperty("Content-Type", "application/json");
            JSONObject data = body.optJSONObject("data");
            payload = (data == null ? "{}" : data.toString())
                    .getBytes(StandardCharsets.UTF_8);
        }

        c.setDoOutput(true);
        c.setFixedLengthStreamingMode(payload.length);
        OutputStream os = c.getOutputStream();
        try {
            os.write(payload);
            os.flush();
        } finally {
            os.close();
        }
    }

    /**
     * Text-only multipart. TorBox's createtorrent takes a magnet as a form
     * field, so file parts are not needed and this stays dependency-free.
     */
    private static byte[] multipart(JSONObject data, String boundary) throws Exception {
        StringBuilder sb = new StringBuilder();
        if (data != null) {
            Iterator<String> it = data.keys();
            while (it.hasNext()) {
                String k = it.next();
                sb.append("--").append(boundary).append("\r\n")
                  .append("Content-Disposition: form-data; name=\"").append(k).append("\"\r\n")
                  .append("\r\n")
                  .append(data.getString(k)).append("\r\n");
            }
        }
        sb.append("--").append(boundary).append("--\r\n");
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static String urlEncoded(JSONObject data) throws Exception {
        StringBuilder sb = new StringBuilder();
        if (data == null) return "";
        Iterator<String> it = data.keys();
        while (it.hasNext()) {
            String k = it.next();
            if (sb.length() > 0) sb.append('&');
            sb.append(URLEncoder.encode(k, "UTF-8"))
              .append('=')
              .append(URLEncoder.encode(data.getString(k), "UTF-8"));
        }
        return sb.toString();
    }

    // ------------------------------------------------------- DNS over HTTPS

    private static final Map<String, String> DNS_CACHE = new ConcurrentHashMap<>();

    /**
     * Resolves a hostname via Cloudflare DoH addressed by literal IP, so it
     * works even when the network's DNS is poisoned or blocked. Cloudflare's
     * certificate covers the bare 1.1.1.1 address, so no bootstrap lookup is
     * needed.
     */
    private static String dohResolve(String host) throws Exception {
        String hit = DNS_CACHE.get(host);
        if (hit != null) return hit;

        URL u = new URL("https://1.1.1.1/dns-query?type=A&name="
                + URLEncoder.encode(host, "UTF-8"));
        HttpURLConnection c = (HttpURLConnection) u.openConnection();
        String body;
        try {
            c.setConnectTimeout(TIMEOUT_MS);
            c.setReadTimeout(TIMEOUT_MS);
            c.setRequestProperty("Accept", "application/dns-json");
            InputStream in = c.getInputStream();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            try {
                while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
            } finally {
                in.close();
            }
            body = out.toString("UTF-8");
        } catch (Exception e) {
            throw new Exception("DNS for " + host + " is blocked on this network, "
                    + "and the fallback resolver could not be reached either. "
                    + "Try Settings > Network > Private DNS > dns.google");
        } finally {
            c.disconnect();
        }

        JSONArray ans = new JSONObject(body).optJSONArray("Answer");
        if (ans != null) {
            for (int i = 0; i < ans.length(); i++) {
                JSONObject a = ans.optJSONObject(i);
                if (a != null && a.optInt("type") == 1) {      // A record
                    String ip = a.optString("data", "");
                    if (!ip.isEmpty()) {
                        DNS_CACHE.put(host, ip);
                        return ip;
                    }
                }
            }
        }
        throw new Exception("Could not resolve " + host);
    }

    /**
     * Opens a connection to an explicit IP while presenting the real hostname
     * in SNI, the Host header, and certificate verification.
     */
    private static HttpURLConnection openByIp(URL orig, String ip) throws Exception {
        final String host = orig.getHost();
        URL byIp = new URL(orig.getProtocol(), ip, orig.getPort(), orig.getFile());
        HttpURLConnection c = (HttpURLConnection) byIp.openConnection();
        c.setRequestProperty("Host", host);

        if (c instanceof HttpsURLConnection) {
            HttpsURLConnection s = (HttpsURLConnection) c;
            s.setSSLSocketFactory(new SniSocketFactory(
                    (SSLSocketFactory) SSLSocketFactory.getDefault(), host));
            // Verify the certificate against the real hostname, never the IP.
            //
            // Deliberately NOT delegating to getDefaultHostnameVerifier(): on
            // the desktop JDK that returns a verifier which always answers
            // false (the real check happens earlier, inside the stack), and
            // relying on the platform default being the Android one would make
            // this untestable off-device. Explicit SAN matching behaves the
            // same everywhere. Chain trust and expiry are still enforced by
            // the TLS stack — only the name match is done here.
            s.setHostnameVerifier(new HostnameVerifier() {
                @Override
                public boolean verify(String ignored, SSLSession session) {
                    return certMatchesHost(session, host);
                }
            });
        }
        return c;
    }

    /**
     * RFC 2818 style hostname match against the peer certificate's dNSName
     * SANs. A wildcard matches exactly one leftmost label, never a bare
     * suffix and never a dot-spanning match.
     */
    private static boolean certMatchesHost(SSLSession session, String host) {
        try {
            Certificate[] chain = session.getPeerCertificates();
            if (chain == null || chain.length == 0) return false;
            if (!(chain[0] instanceof X509Certificate)) return false;

            Collection<List<?>> sans = ((X509Certificate) chain[0]).getSubjectAlternativeNames();
            if (sans == null) return false;

            String h = host.toLowerCase(Locale.US);
            for (List<?> san : sans) {
                if (san == null || san.size() < 2) continue;
                Object type = san.get(0);
                if (!(type instanceof Integer) || (Integer) type != 2) continue;  // dNSName
                String name = String.valueOf(san.get(1)).toLowerCase(Locale.US);
                if (name.isEmpty()) continue;

                if (name.equals(h)) return true;

                if (name.startsWith("*.")) {
                    String suffix = name.substring(1);          // ".example.com"
                    int dot = h.indexOf('.');                   // first dot only,
                    // so the wildcard consumes exactly one leftmost label
                    if (dot > 0 && h.substring(dot).equals(suffix)) return true;
                }
            }
        } catch (Exception ignored) {
            // any failure to inspect the chain means "not verified"
        }
        return false;
    }

    /** Delegating factory that stamps the real hostname into the TLS SNI extension. */
    private static class SniSocketFactory extends SSLSocketFactory {
        private final SSLSocketFactory d;
        private final String host;

        SniSocketFactory(SSLSocketFactory d, String host) { this.d = d; this.host = host; }

        private Socket sni(Socket s) {
            if (s instanceof SSLSocket) {
                SSLSocket ss = (SSLSocket) s;
                SSLParameters p = ss.getSSLParameters();
                p.setServerNames(Collections.<SNIServerName>singletonList(new SNIHostName(host)));
                ss.setSSLParameters(p);
            }
            return s;
        }

        @Override public String[] getDefaultCipherSuites() { return d.getDefaultCipherSuites(); }
        @Override public String[] getSupportedCipherSuites() { return d.getSupportedCipherSuites(); }
        @Override public Socket createSocket(Socket s, String h, int p, boolean a) throws IOException { return sni(d.createSocket(s, h, p, a)); }
        @Override public Socket createSocket(String h, int p) throws IOException { return sni(d.createSocket(h, p)); }
        @Override public Socket createSocket(String h, int p, InetAddress la, int lp) throws IOException { return sni(d.createSocket(h, p, la, lp)); }
        @Override public Socket createSocket(InetAddress h, int p) throws IOException { return sni(d.createSocket(h, p)); }
        @Override public Socket createSocket(InetAddress h, int p, InetAddress la, int lp) throws IOException { return sni(d.createSocket(h, p, la, lp)); }
    }

    // ---------------------------------------------------------------- utils

    /**
     * Exception text without the URL. Some JDK exceptions put the full URL in
     * getMessage(), which would leak the TorBox token into the page.
     */
    private static String describe(Exception e) {
        String m = e.getMessage();
        if (m == null || m.isEmpty()) return e.getClass().getSimpleName();
        if (m.contains("://")) return e.getClass().getSimpleName();
        return m;
    }

    private static String safeName(String name) {
        if (name == null || name.trim().isEmpty()) return "nyaarank-download";
        String s = name.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_").trim();
        if (s.length() > 120) s = s.substring(0, 120);
        return s.isEmpty() ? "nyaarank-download" : s;
    }
}
