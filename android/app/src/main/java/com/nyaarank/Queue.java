package com.nyaarank;

import android.app.DownloadManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The download queue, deliberately free of the Activity.
 *
 * DownloadManager already downloads in the background; what used to stop was
 * this queue, because the receiver advancing it was registered by the Activity
 * and died with it. So the running file finished and the next never started,
 * meaning a batch only progressed while you sat in the app.
 *
 * Everything here takes a Context and reads its state from SharedPreferences,
 * so DownloadWatcher can drive it with no app running at all.
 */
final class Queue {

    private Queue() {}

    static final String PREFS = "nyaarank";
    private static final String QUEUE_KEY = "dl_queue";

    /**
     * One at a time. A batch downloading in parallel on a mobile connection
     * means every episode crawls and none finishes; serialising means the
     * first is watchable while the rest are still coming.
     */
    private static final int MAX_ACTIVE = 1;

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized JSONArray read(Context c) {
        try { return new JSONArray(prefs(c).getString(QUEUE_KEY, "[]")); }
        catch (Exception e) { return new JSONArray(); }
    }

    static synchronized void write(Context c, JSONArray q) {
        prefs(c).edit().putString(QUEUE_KEY, q.toString()).apply();
    }

    static int size(Context c) { return read(c).length(); }

    /** Adds a file, at the back or — for a retry that already had its turn — the front. */
    static synchronized void add(Context c, String url, String name, String folder, boolean front) {
        try {
            JSONObject job = new JSONObject();
            job.put("u", url);
            job.put("n", name == null ? "" : name);
            job.put("f", folder == null ? "" : folder);

            JSONArray old = read(c);
            JSONArray q = new JSONArray();
            if (front) q.put(job);
            for (int i = 0; i < old.length(); i++) q.put(old.get(i));
            if (!front) q.put(job);
            write(c, q);
            pump(c);
        } catch (Exception ignored) {}
    }

    /** Drops a file that has not started. */
    static synchronized void remove(Context c, String name, String folder) {
        try {
            JSONArray q = read(c), keep = new JSONArray();
            for (int i = 0; i < q.length(); i++) {
                JSONObject j = q.optJSONObject(i);
                if (j == null) continue;
                boolean match = safeName(j.optString("n")).equals(name)
                             && safeFolder(j.optString("f")).equals(folder);
                if (!match) keep.put(j);
            }
            write(c, keep);
        } catch (Exception ignored) {}
    }

    /**
     * Media downloads holding a slot.
     *
     * PAUSED is excluded on purpose: it uses no bandwidth, and counting it
     * deadlocked the queue — one file stuck "waiting to retry" stopped every
     * other file from starting, and nothing completing meant nothing ever
     * pumped the queue either.
     */
    private static int active(Context c) {
        DownloadManager dm = (DownloadManager) c.getSystemService(Context.DOWNLOAD_SERVICE);
        if (dm == null) return 0;
        Cursor cur = null;
        int n = 0;
        try {
            DownloadManager.Query q = new DownloadManager.Query();
            q.setFilterByStatus(DownloadManager.STATUS_RUNNING | DownloadManager.STATUS_PENDING);
            cur = dm.query(q);
            while (cur != null && cur.moveToNext()) {
                String t = null;
                try { t = cur.getString(cur.getColumnIndexOrThrow(DownloadManager.COLUMN_TITLE)); }
                catch (Exception ignored) {}
                if (t != null && t.startsWith("nyaarank update")) continue;   // priority lane
                n++;
            }
        } catch (Exception ignored) {
        } finally {
            if (cur != null) try { cur.close(); } catch (Exception ignored) {}
        }
        return n;
    }

    /** Starts as many queued files as there are free slots. */
    static synchronized void pump(Context c) {
        try {
            JSONArray q = read(c);
            if (q.length() == 0) return;

            int free = MAX_ACTIVE - active(c);
            if (free <= 0) return;

            DownloadManager dm = (DownloadManager) c.getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm == null) return;

            JSONArray rest = new JSONArray();
            for (int i = 0; i < q.length(); i++) {
                JSONObject job = q.optJSONObject(i);
                if (job == null) continue;
                if (free <= 0) { rest.put(job); continue; }

                try {
                    String name = safeName(job.optString("n"));
                    String dir  = safeFolder(job.optString("f"));
                    String path = "nyaarank/" + (dir.isEmpty() ? "" : dir + "/") + name;

                    DownloadManager.Request r =
                            new DownloadManager.Request(Uri.parse(job.getString("u")));
                    r.setTitle(name);
                    r.setDescription(dir.isEmpty() ? "nyaarank" : dir);
                    r.setNotificationVisibility(
                            DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, path);
                    dm.enqueue(r);
                    free--;
                } catch (Exception badJob) {
                    // unusable job is dropped rather than retried forever at the head
                }
            }
            write(c, rest);
        } catch (Exception ignored) {}
    }

    static String safeFolder(String name) {
        if (name == null) return "";
        String s = name.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_")
                       .replaceAll("^[.\\s]+", "")
                       .trim();
        if (s.length() > 90) s = s.substring(0, 90).trim();
        return s;
    }

    static String safeName(String name) {
        if (name == null || name.trim().isEmpty()) return "nyaarank-download";
        String s = name.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_").trim();
        if (s.length() > 120) s = s.substring(0, 120);
        return s.isEmpty() ? "nyaarank-download" : s;
    }
}
