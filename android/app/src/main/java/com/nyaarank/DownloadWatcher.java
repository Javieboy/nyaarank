package com.nyaarank;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Advances the download queue with no app running.
 *
 * Declared in the manifest rather than registered by the Activity, so Android
 * delivers it whether or not nyaarank is open. DownloadManager's completion
 * broadcast is exempt from the Android 8 restriction on implicit broadcasts to
 * manifest receivers, which is what makes this possible without a foreground
 * service or a permanent notification.
 *
 * It only starts the next file. Installing an update is left to the Activity:
 * launching one from a background receiver is blocked on Android 10 and up,
 * and you are in the app when you tap update anyway.
 */
public class DownloadWatcher extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        if (!android.app.DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(intent.getAction())) return;

        // A completion is the signal, whichever download it was: our own
        // queue only needs to know a slot freed up.
        Queue.pump(context.getApplicationContext());
    }
}
