package com.rc.appointmentmaker;

import android.os.Bundle;
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
    }
}
