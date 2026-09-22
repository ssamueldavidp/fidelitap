import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../data/mobile_api_client.dart';
import '../core/app_colors.dart';
import '../core/business_categories.dart';
import '../shared/wallet_preview_card.dart';
import '../auth/activate_card_screen.dart';

/// Tiendas cercanas — a Pro+ perk for businesses (see
/// /api/mobile/directory/businesses): browse nearby loyalty-card businesses,
/// optionally filtered by category, either around the device's current
/// location or a manually typed city/address (Rappi-style — "browse as if I
/// were there").
class StoresScreen extends StatefulWidget {
  const StoresScreen({super.key});

  @override
  State<StoresScreen> createState() => _StoresScreenState();
}

class _StoresScreenState extends State<StoresScreen> {
  final _api = MobileApiClient();
  final _cityController = TextEditingController();

  bool _loading = true;
  String? _error;
  List<StoreListingModel> _stores = [];

  double? _lat;
  double? _lng;
  String? _city;
  String _locationLabel = 'Elige tu ubicación';
  String? _category;

  @override
  void initState() {
    super.initState();
    _useCurrentLocation(silent: true);
  }

  @override
  void dispose() {
    _cityController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final stores = await _api.getNearbyStores(
        lat: _lat, lng: _lng, city: _city, category: _category, radiusKm: 25,
      );
      setState(() { _stores = stores; _loading = false; });
    } catch (e) {
      setState(() { _error = 'No se pudieron cargar las tiendas'; _loading = false; });
    }
  }

  Future<void> _useCurrentLocation({bool silent = false}) async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        if (!silent && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Activa el permiso de ubicación o busca por ciudad')),
          );
        }
        if (!silent) return;
        setState(() { _loading = false; });
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.low),
      );
      setState(() {
        _lat = pos.latitude;
        _lng = pos.longitude;
        _city = null;
        _cityController.clear();
        _locationLabel = 'Tu ubicación actual';
      });
      await _load();
    } catch (e) {
      if (!silent) {
        setState(() { _loading = false; _error = 'No se pudo obtener tu ubicación'; });
      } else {
        setState(() { _loading = false; });
      }
    }
  }

  Future<void> _searchCity(String city) async {
    if (city.trim().isEmpty) return;
    setState(() {
      _city = city.trim();
      _lat = null;
      _lng = null;
      _locationLabel = city.trim();
    });
    Navigator.of(context).pop();
    await _load();
  }

  Future<void> _openLocationPicker() async {
    await showModalBottomSheet(
      context: context,
      backgroundColor: context.colors.bg,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: EdgeInsets.only(
          left: 20, right: 20, top: 20,
          bottom: MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('¿Dónde buscamos?', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: context.colors.textPrimary)),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.of(context).pop();
                _useCurrentLocation();
              },
              icon: const Icon(Icons.my_location),
              label: const Text('Usar mi ubicación actual'),
            ),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: Divider(color: context.colors.divider)),
              Padding(padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Text('o', style: TextStyle(color: context.colors.textMuted))),
              Expanded(child: Divider(color: context.colors.divider)),
            ]),
            const SizedBox(height: 16),
            TextField(
              controller: _cityController,
              decoration: const InputDecoration(
                hintText: 'Buscar por ciudad o dirección',
                prefixIcon: Icon(Icons.location_city_outlined),
              ),
              onSubmitted: _searchCity,
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => _searchCity(_cityController.text),
                child: const Text('Buscar'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openStore(StoreListingModel store) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ActivateCardScreen(slug: store.primaryCardSlug)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tiendas cercanas'),
        actions: [IconButton(onPressed: _load, icon: const Icon(Icons.refresh))],
      ),
      body: Column(children: [
        // Rappi-style location bar
        InkWell(
          onTap: _openLocationPicker,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: colors.surface,
            child: Row(children: [
              const Icon(Icons.location_on, color: Color(0xFF00C896), size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(_locationLabel,
                    style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
                    overflow: TextOverflow.ellipsis),
              ),
              Icon(Icons.keyboard_arrow_down, color: colors.textMuted),
            ]),
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            children: [
              _CategoryChip(label: 'Todas', selected: _category == null, onTap: () { setState(() => _category = null); _load(); }),
              ...businessCategories.map((c) => _CategoryChip(
                    label: c,
                    selected: _category == c,
                    onTap: () { setState(() => _category = c); _load(); },
                  )),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF00C896)))
              : _error != null
                  ? Center(child: Text(_error!, style: TextStyle(color: colors.textMuted)))
                  : _stores.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(32),
                            child: Column(mainAxisSize: MainAxisSize.min, children: [
                              Icon(Icons.storefront_outlined, size: 48, color: colors.textMuted),
                              const SizedBox(height: 12),
                              Text('No hay tiendas Pro por aquí todavía',
                                  textAlign: TextAlign.center, style: TextStyle(color: colors.textMuted)),
                            ]),
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: _load,
                          color: const Color(0xFF00C896),
                          child: ListView.separated(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
                            itemCount: _stores.length,
                            separatorBuilder: (_, _) => const SizedBox(height: 10),
                            itemBuilder: (_, i) => _StoreTile(store: _stores[i], onTap: () => _openStore(_stores[i])),
                          ),
                        ),
        ),
      ]),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _CategoryChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF00C896) : colors.surface,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              color: selected ? Colors.black : colors.textMuted,
              fontWeight: selected ? FontWeight.bold : FontWeight.w500,
              fontSize: 14,
            ),
          ),
        ),
      ),
    );
  }
}

class _StoreTile extends StatelessWidget {
  final StoreListingModel store;
  final VoidCallback onTap;
  const _StoreTile({required this.store, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final expiresAt = store.expiresAt != null ? DateTime.tryParse(store.expiresAt!) : null;
    final daysLeft = expiresAt?.difference(DateTime.now()).inDays;
    final isUrgent = daysLeft != null && daysLeft <= 7;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: colors.surface, borderRadius: BorderRadius.circular(16)),
        child: Row(children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 56,
              height: 56,
              child: store.avatarUrl != null
                  ? Image.network(store.avatarUrl!, fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => _fallbackAvatar(colors))
                  : _fallbackAvatar(colors),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(store.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15)),
              const SizedBox(height: 2),
              Row(children: [
                if (store.category != null) ...[
                  Text(store.category!, style: TextStyle(color: colors.textMuted, fontSize: 12)),
                  if (store.distanceKm != null) Text('  ·  ', style: TextStyle(color: colors.textMuted, fontSize: 12)),
                ],
                if (store.distanceKm != null)
                  Text('${store.distanceKm!.toStringAsFixed(1)} km', style: TextStyle(color: colors.textMuted, fontSize: 12)),
              ]),
              const SizedBox(height: 6),
              Row(children: [
                Icon(Icons.card_giftcard, size: 14, color: hexToColor(store.designConfig['color'] as String? ?? '#00C896')),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(store.benefitDescription, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
                ),
              ]),
              if (isUrgent) ...[
                const SizedBox(height: 4),
                Text('⚠️ Vence en $daysLeft días',
                    style: const TextStyle(color: Color(0xFFEF4444), fontSize: 10, fontWeight: FontWeight.w600)),
              ],
            ]),
          ),
          Icon(Icons.chevron_right, color: colors.textMuted),
        ]),
      ),
    );
  }

  Widget _fallbackAvatar(AppColors colors) => Container(
        color: colors.surfaceAlt,
        child: Center(child: Text(store.designConfig['stamp_icon'] as String? ?? '🏪', style: const TextStyle(fontSize: 24))),
      );
}
