import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'core/supabase_client.dart';
import 'core/notification_service.dart';
import 'push/push_service.dart';
import 'app.dart';

// FCM background message handler — must be top-level function
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage _) async {
  // Background messages are handled by the OS notification tray.
  // No action needed here for geofence push — tap opens the app.
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initSupabase();
  await initNotifications();

  // Initialize Firebase (no-op if google-services files contain placeholder values)
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Handle tap on a notification when the app was terminated
    final initial = await FirebaseMessaging.instance.getInitialMessage();
    if (initial != null) _handlePushTap(initial);

    // Handle tap when app is in background (not terminated)
    FirebaseMessaging.onMessageOpenedApp.listen(_handlePushTap);

    // Register FCM token
    await initPush();
  } catch (e) {
    // Firebase not configured yet — app runs normally without push
    debugPrint('[main] Firebase not configured: $e');
  }

  runApp(const FideliTapApp());
}

void _handlePushTap(RemoteMessage message) {
  // Geofence pushes include business_id; navigate customer to their cards
  navigatorKey.currentState?.pushNamedAndRemoveUntil('/customer/cards', (_) => false);
}
