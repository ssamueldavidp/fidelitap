import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:http_parser/http_parser.dart';
import '../core/supabase_client.dart';
import '../core/env.dart';

// ── Models ────────────────────────────────────────────────────────────────

class CardRewardModel {
  final String id;
  final int stampsRequired;
  final String rewardLabel;
  final String color;
  final int sortOrder;

  const CardRewardModel({
    required this.id,
    required this.stampsRequired,
    required this.rewardLabel,
    required this.color,
    required this.sortOrder,
  });

  factory CardRewardModel.fromJson(Map<String, dynamic> j) => CardRewardModel(
        id: j['id'] as String,
        stampsRequired: j['stamps_required'] as int,
        rewardLabel: j['reward_label'] as String,
        color: (j['color'] as String?) ?? '#00C896',
        sortOrder: (j['sort_order'] as int?) ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'stamps_required': stampsRequired,
        'reward_label': rewardLabel,
        'color': color,
        'sort_order': sortOrder,
      };
}

class LoyaltyCardModel {
  final String id;
  final String name;
  final int stampsRequired;
  final String benefitDescription;
  final String stampIcon;
  final String color;
  final String bgType;
  final String bgValue;
  final String? bgImageUrl;
  final String font;
  final String? logoUrl;
  final String? expiresAt;
  final int? maxUsesPerCustomer;
  final bool multiRewards;
  final bool isActive;
  final String? slug;
  final List<CardRewardModel> rewards;

  const LoyaltyCardModel({
    required this.id,
    required this.name,
    required this.stampsRequired,
    required this.benefitDescription,
    required this.stampIcon,
    required this.color,
    required this.bgType,
    required this.bgValue,
    this.bgImageUrl,
    required this.font,
    this.logoUrl,
    this.expiresAt,
    this.maxUsesPerCustomer,
    required this.multiRewards,
    required this.isActive,
    this.slug,
    required this.rewards,
  });

  factory LoyaltyCardModel.fromJson(Map<String, dynamic> j) => LoyaltyCardModel(
        id: j['id'] as String,
        name: j['name'] as String,
        stampsRequired: j['stamps_required'] as int,
        benefitDescription: j['benefit_description'] as String,
        stampIcon: (j['stamp_icon'] as String?) ?? '⭐',
        color: (j['color'] as String?) ?? '#00C896',
        bgType: (j['bg_type'] as String?) ?? 'solid',
        bgValue: (j['bg_value'] as String?) ?? '#0f172a',
        bgImageUrl: j['bg_image_url'] as String?,
        font: (j['font'] as String?) ?? 'default',
        logoUrl: j['logo_url'] as String?,
        expiresAt: j['expires_at'] as String?,
        maxUsesPerCustomer: j['max_uses_per_customer'] as int?,
        multiRewards: (j['multi_rewards'] as bool?) ?? false,
        isActive: j['is_active'] as bool? ?? true,
        slug: j['slug'] as String?,
        rewards: ((j['rewards'] as List<dynamic>?) ?? [])
            .map((e) => CardRewardModel.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class CustomerModel {
  final String customerId;
  final String customerName;
  final String cardName;
  final String loyaltyCardId;
  final int currentStamps;
  final int stampsRequired;
  final int timesCompleted;
  final String? lastVisit;

  const CustomerModel({
    required this.customerId,
    required this.customerName,
    required this.cardName,
    required this.loyaltyCardId,
    required this.currentStamps,
    required this.stampsRequired,
    required this.timesCompleted,
    this.lastVisit,
  });

  factory CustomerModel.fromJson(Map<String, dynamic> j) => CustomerModel(
        customerId: j['customer_id'] as String,
        customerName: j['customer_name'] as String,
        cardName: j['card_name'] as String,
        loyaltyCardId: j['loyalty_card_id'] as String,
        currentStamps: j['current_stamps'] as int,
        stampsRequired: j['stamps_required'] as int,
        timesCompleted: j['times_completed'] as int,
        lastVisit: j['last_visit'] as String?,
      );
}

class BusinessSettings {
  final String name;
  final String? address;
  final double? latitude;
  final double? longitude;
  final int stampCooldownSeconds;
  final String plan;
  final bool geofenceEnabled;
  final int geofenceRadiusM;
  final String geofenceMessage;
  final int geofenceCooldownH;
  final int quietHoursStart;
  final int quietHoursEnd;

  const BusinessSettings({
    required this.name,
    this.address,
    this.latitude,
    this.longitude,
    required this.stampCooldownSeconds,
    required this.plan,
    required this.geofenceEnabled,
    required this.geofenceRadiusM,
    required this.geofenceMessage,
    required this.geofenceCooldownH,
    required this.quietHoursStart,
    required this.quietHoursEnd,
  });

  factory BusinessSettings.fromJson(Map<String, dynamic> j) => BusinessSettings(
        name: j['name'] as String,
        address: j['address'] as String?,
        latitude: (j['latitude'] as num?)?.toDouble(),
        longitude: (j['longitude'] as num?)?.toDouble(),
        stampCooldownSeconds: j['stamp_cooldown_seconds'] as int? ?? 0,
        plan: j['plan'] as String? ?? 'free',
        geofenceEnabled: j['geofence_enabled'] as bool? ?? false,
        geofenceRadiusM: j['geofence_radius_m'] as int? ?? 300,
        geofenceMessage: j['geofence_message'] as String? ?? '',
        geofenceCooldownH: j['geofence_cooldown_h'] as int? ?? 24,
        quietHoursStart: j['quiet_hours_start'] as int? ?? 22,
        quietHoursEnd: j['quiet_hours_end'] as int? ?? 6,
      );
}

// ── HTTP Client ───────────────────────────────────────────────────────────

class MobileApiClient {
  String get _base => Env.apiBaseUrl;
  String get _supabaseBase => Env.supabaseUrl;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Authorization':
            'Bearer ${supabase.auth.currentSession?.accessToken ?? ''}',
      };

  Future<dynamic> get(String path) async {
    final res = await http.get(Uri.parse('$_base$path'), headers: _headers);
    return jsonDecode(res.body);
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$_base$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> patch(String path, Map<String, dynamic> body) async {
    final res = await http.patch(
      Uri.parse('$_base$path'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> delete(String path, [Map<String, dynamic>? body]) async {
    final req = http.Request('DELETE', Uri.parse('$_base$path'));
    _headers.forEach((k, v) => req.headers[k] = v);
    if (body != null) req.body = jsonEncode(body);
    final streamed = await req.send();
    final bytes = await streamed.stream.toBytes();
    final text = utf8.decode(bytes);
    if (text.isEmpty) return {};
    return jsonDecode(text) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> postFunction(
      String functionName, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$_supabaseBase/functions/v1/$functionName'),
      headers: _headers,
      body: jsonEncode(body),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<String> uploadLogo(List<int> bytes, String mimeType) async {
    final mimeSubtype = mimeType.contains('png')
        ? 'png'
        : mimeType.contains('webp')
            ? 'webp'
            : 'jpeg';  // ← 'jpeg', not 'jpg'
    final ext = mimeSubtype == 'jpeg' ? 'jpg' : mimeSubtype;  // filename uses .jpg
    final req = http.MultipartRequest(
      'POST',
      Uri.parse('$_base/api/mobile/upload/logo'),
    );
    req.headers['Authorization'] =
        'Bearer ${supabase.auth.currentSession?.accessToken ?? ''}';
    req.files.add(http.MultipartFile.fromBytes(
      'file',
      bytes,
      filename: 'logo.$ext',
      contentType: MediaType('image', mimeSubtype),  // ← use mimeSubtype here
    ));
    final streamed = await req.send();
    final body = await streamed.stream.bytesToString();
    final json = jsonDecode(body) as Map<String, dynamic>;
    if (streamed.statusCode != 201) throw Exception(json['error'] ?? 'Upload failed');
    return json['public_url'] as String;
  }

  // ── Typed API methods ─────────────────────────────────────────────────

  Future<List<LoyaltyCardModel>> getCards() async {
    final data = await get('/api/mobile/cards') as List<dynamic>;
    return data.map((e) => LoyaltyCardModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Map<String, dynamic>> createCard(Map<String, dynamic> body) =>
      post('/api/mobile/cards', body);

  Future<Map<String, dynamic>> updateCard(String id, Map<String, dynamic> body) =>
      patch('/api/mobile/cards/$id', body);

  Future<void> deleteCard(String id) => delete('/api/mobile/cards/$id');

  Future<List<CustomerModel>> getCustomers({String? cardId}) async {
    final path = cardId != null
        ? '/api/mobile/customers?card_id=$cardId'
        : '/api/mobile/customers';
    final data = await get(path) as List<dynamic>;
    return data.map((e) => CustomerModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<BusinessSettings> getSettings() async {
    final data = await get('/api/mobile/settings') as Map<String, dynamic>;
    return BusinessSettings.fromJson(data);
  }

  Future<Map<String, dynamic>> saveSettings(Map<String, dynamic> body) =>
      patch('/api/mobile/settings', body);
}
