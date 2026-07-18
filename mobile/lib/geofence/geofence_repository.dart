import 'package:shared_preferences/shared_preferences.dart';
import '../data/mobile_api_client.dart';

class BusinessGeoInfo {
  final String businessId;
  final String businessName;
  final String customerCardId;
  final double latitude;
  final double longitude;
  final int currentStamps;
  final int stampsRequired;
  final int geofenceRadiusM;

  const BusinessGeoInfo({
    required this.businessId,
    required this.businessName,
    required this.customerCardId,
    required this.latitude,
    required this.longitude,
    required this.currentStamps,
    required this.stampsRequired,
    required this.geofenceRadiusM,
  });
}

class GeofenceRepository {
  Future<List<BusinessGeoInfo>> fetchEligibleBusinesses() async {
    final prefs = await SharedPreferences.getInstance();
    final disabled = (prefs.getStringList('disabled_geofences') ?? []).toSet();

    final res = await MobileApiClient().get('/api/mobile/customer-cards');
    final cards = res['cards'] as List<dynamic>? ?? [];

    final result = <BusinessGeoInfo>[];
    for (final card in cards) {
      final c = card as Map<String, dynamic>;
      final lc = c['loyalty_cards'] as Map<String, dynamic>? ?? {};
      final biz = lc['businesses'] as Map<String, dynamic>? ?? {};

      final plan = biz['plan'] as String? ?? 'free';
      if (plan != 'pro' && plan != 'premium') continue;

      final geofenceEnabled = biz['geofence_enabled'] as bool? ?? false;
      if (!geofenceEnabled) continue;

      final lat = biz['latitude'];
      final lng = biz['longitude'];
      if (lat == null || lng == null) continue;

      final bizId = biz['id'] as String? ?? '';
      if (disabled.contains(bizId) || bizId.isEmpty) continue;

      result.add(BusinessGeoInfo(
        businessId: bizId,
        businessName: biz['name'] as String? ?? '',
        customerCardId: c['id'] as String? ?? '',
        latitude: (lat as num).toDouble(),
        longitude: (lng as num).toDouble(),
        currentStamps: c['current_stamps'] as int? ?? 0,
        stampsRequired: lc['stamps_required'] as int? ?? 1,
        geofenceRadiusM: biz['geofence_radius_m'] as int? ?? 300,
      ));
    }
    return result;
  }
}
