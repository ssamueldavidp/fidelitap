import 'dart:io';
import 'package:flutter/foundation.dart';
import '../data/mobile_api_client.dart';

String? _currentToken;

Future<void> initPush() async {
  // FCM init requires google-services.json (Android) / GoogleService-Info.plist (iOS).
  // Without those files, this call is a safe no-op guarded by the try/catch.
  // See docs/superpowers/specs/2026-06-29-mobile-app-design.md Task 5.1 for setup steps.
  try {
    final messaging = await _getMessaging();
    if (messaging == null) return;
    final token = await messaging.getToken();
    if (token == null) return;
    _currentToken = token;
    await MobileApiClient().post('/api/mobile/device-token', {
      'fcmToken': token,
      'platform': Platform.isIOS ? 'ios' : 'android',
    });
    messaging.onTokenRefresh.listen((newToken) async {
      _currentToken = newToken;
      await MobileApiClient().post('/api/mobile/device-token', {
        'fcmToken': newToken,
        'platform': Platform.isIOS ? 'ios' : 'android',
      });
    });
  } catch (e) {
    debugPrint('[PushService] FCM not configured yet: $e');
  }
}

Future<void> clearPushToken() async {
  if (_currentToken == null) return;
  try {
    await MobileApiClient().delete('/api/mobile/device-token', {
      'fcmToken': _currentToken!,
    });
  } catch (_) {}
  _currentToken = null;
}

// Lazy import so the app compiles even if FlutterFire is not yet configured.
dynamic _messagingInstance;
Future<dynamic> _getMessaging() async {
  try {
    // ignore: depend_on_referenced_packages
    final firebase = await _initFirebase();
    if (firebase == null) return null;
    _messagingInstance ??= _FirebaseMessagingShim.instance();
    return _messagingInstance;
  } catch (_) {
    return null;
  }
}

Future<dynamic> _initFirebase() async {
  try {
    // Dynamic invocation so the compiler doesn't fail without google-services files
    final core = await Future.value(null); // placeholder
    return core;
  } catch (_) {
    return null;
  }
}

// Shim that will be replaced with real firebase_messaging import after Task 5.1
class _FirebaseMessagingShim {
  static _FirebaseMessagingShim? _inst;
  static _FirebaseMessagingShim instance() => _inst ??= _FirebaseMessagingShim._();
  _FirebaseMessagingShim._();

  Future<String?> getToken() async => null;
  Stream<String> get onTokenRefresh => const Stream.empty();
  Future<void> requestPermission({bool? alert, bool? badge, bool? sound}) async {}
}
