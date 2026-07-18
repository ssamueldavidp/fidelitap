import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import '../data/mobile_api_client.dart';

String? _currentToken;

Future<void> initPush() async {
  try {
    final messaging = FirebaseMessaging.instance;

    // Request permission (iOS requires explicit permission; Android 13+ too)
    await messaging.requestPermission(alert: true, badge: true, sound: true);

    final token = await messaging.getToken();
    if (token == null) return;
    _currentToken = token;
    await _registerToken(token);

    messaging.onTokenRefresh.listen((newToken) async {
      _currentToken = newToken;
      await _registerToken(newToken);
    });
  } catch (e) {
    debugPrint('[PushService] FCM init failed: $e');
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

Future<void> _registerToken(String token) async {
  try {
    await MobileApiClient().post('/api/mobile/device-token', {
      'fcmToken': token,
      'platform': Platform.isIOS ? 'ios' : 'android',
    });
  } catch (e) {
    debugPrint('[PushService] token registration failed: $e');
  }
}
