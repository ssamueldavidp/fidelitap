import 'package:flutter/foundation.dart';
import 'package:geofence_service/geofence_service.dart';
import '../data/mobile_api_client.dart';
import 'geofence_repository.dart';

class GeofenceManager {
  final _service = GeofenceService.instance.setup(
    interval: 5000,
    accuracy: 100,
    loiteringDelayMs: 60000,
    statusChangeDelayMs: 10000,
    geofenceRadiusSortType: GeofenceRadiusSortType.DESC,
  );

  bool _running = false;

  Future<void> startIfEligible() async {
    try {
      final businesses = await GeofenceRepository().fetchEligibleBusinesses();
      if (businesses.isEmpty) return;

      final geofences = businesses.map((b) => Geofence(
            id: b.businessId,
            latitude: b.latitude,
            longitude: b.longitude,
            radius: [GeofenceRadius(id: 'r${b.geofenceRadiusM}', length: b.geofenceRadiusM.toDouble())],
          )).toList();

      _service.addGeofenceStatusChangeListener(_onStatusChange);
      await _service.start(geofences);
      _running = true;
    } catch (e) {
      debugPrint('[GeofenceManager] start failed: $e');
    }
  }

  Future<void> stop() async {
    if (!_running) return;
    try {
      await _service.stop();
      _running = false;
    } catch (_) {}
  }

  Future<void> _onStatusChange(
    Geofence geofence,
    GeofenceRadius radius,
    GeofenceStatus status,
    Location location,
  ) async {
    if (status != GeofenceStatus.ENTER) return;
    try {
      await MobileApiClient().post('/api/mobile/geofence/notify', {
        'business_id': geofence.id,
      });
    } catch (e) {
      debugPrint('[GeofenceManager] notify failed: $e');
    }
  }
}
