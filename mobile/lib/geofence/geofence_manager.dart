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

  List<BusinessGeoInfo> _businesses = [];
  bool _running = false;

  Future<void> startIfEligible() async {
    try {
      final businesses = await GeofenceRepository().fetchProPlusBusinessesWithLocation();
      if (businesses.isEmpty) return;
      _businesses = businesses;

      final geofences = businesses.map((b) => Geofence(
            id: b.businessId,
            latitude: b.latitude,
            longitude: b.longitude,
            radius: [GeofenceRadius(id: 'r300', length: 300)],
          )).toList();

      _service.addGeofenceStatusChangeListener(_onStatusChange);
      // geofence_service requests location permissions internally when starting
      await _service.start(geofences);
      _running = true;
    } catch (e) {
      // Typically thrown when the user denies location permission or
      // the platform doesn't support background location.
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
      final biz = _businesses.firstWhere((b) => b.businessId == geofence.id);
      await MobileApiClient().postFunction('geofence-checkin', {
        'customer_card_id': biz.customerCardId,
        'business_id': biz.businessId,
        'latitude': location.latitude,
        'longitude': location.longitude,
      });
    } catch (e) {
      debugPrint('[GeofenceManager] checkin failed: $e');
    }
  }
}
