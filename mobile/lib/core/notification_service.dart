import 'package:flutter_local_notifications/flutter_local_notifications.dart';

final _plugin = FlutterLocalNotificationsPlugin();

Future<void> initNotifications() async {
  const android = AndroidInitializationSettings('@mipmap/ic_launcher');
  const iOS = DarwinInitializationSettings(
    requestAlertPermission: true,
    requestBadgePermission: true,
    requestSoundPermission: true,
  );
  await _plugin.initialize(
    const InitializationSettings(android: android, iOS: iOS),
  );
}

Future<void> showWalletAddedNotification({required String cardName}) async {
  const androidDetails = AndroidNotificationDetails(
    'wallet_channel',
    'Wallet',
    channelDescription: 'Notificaciones de tarjetas en Wallet',
    importance: Importance.high,
    priority: Priority.high,
    icon: '@mipmap/ic_launcher',
  );
  const iOSDetails = DarwinNotificationDetails(
    presentAlert: true,
    presentBadge: false,
    presentSound: true,
  );
  const details = NotificationDetails(android: androidDetails, iOS: iOSDetails);

  await _plugin.show(
    DateTime.now().millisecondsSinceEpoch ~/ 1000,
    '¡Tarjeta agregada al Wallet! 🎉',
    'Tu tarjeta "$cardName" ya está guardada en tu Wallet.',
    details,
  );
}
