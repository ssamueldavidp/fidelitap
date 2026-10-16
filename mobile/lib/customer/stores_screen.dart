import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../data/mobile_api_client.dart';
import '../core/app_colors.dart';
import '../core/theme.dart';
import '../shared/ui.dart';
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
  String _query = '';

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
      isScrollControlled: true,
      backgroundColor: context.colors.bg,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
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

  List<StoreListingModel> get _filtered {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return _stores;
    return _stores
        .where((s) => s.name.toLowerCase().contains(q) || s.benefitDescription.toLowerCase().contains(q))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final stores = _filtered;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Row(children: [
              Expanded(
                child: InkWell(
                  onTap: _openLocationPicker,
                  borderRadius: BorderRadius.circular(16),
                  child: Row(children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(shape: BoxShape.circle, color: colors.brandSoft),
                      child: Icon(Icons.location_on_rounded, color: colors.brand, size: 22),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Cerca de', style: TextStyle(color: colors.textMuted, fontSize: 12, fontWeight: FontWeight.w600)),
                        Row(children: [
                          Flexible(
                            child: Text(_locationLabel,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: displayStyle(size: 18, color: colors.textPrimary)),
                          ),
                          Icon(Icons.keyboard_arrow_down_rounded, color: colors.textPrimary, size: 20),
                        ]),
                      ]),
                    ),
                  ]),
                ),
              ),
              const SizedBox(width: 12),
              IconButton.filled(
                onPressed: _load,
                tooltip: 'Actualizar',
                style: IconButton.styleFrom(
                  backgroundColor: colors.surface,
                  foregroundColor: colors.textPrimary,
                  side: BorderSide(color: colors.border),
                  minimumSize: const Size(48, 48),
                ),
                icon: const Icon(Icons.refresh_rounded),
              ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Container(
              height: 52,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: BorderRadius.circular(26),
                border: Border.all(color: colors.border),
                boxShadow: colors.shadow,
              ),
              child: Row(children: [
                Icon(Icons.search_rounded, color: colors.textMuted),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    onChanged: (v) => setState(() => _query = v),
                    style: TextStyle(color: colors.textPrimary, fontSize: 15),
                    decoration: InputDecoration(
                      hintText: 'Busca tiendas o premios',
                      hintStyle: TextStyle(color: colors.textMuted),
                      filled: false,
                      isCollapsed: true,
                      contentPadding: EdgeInsets.zero,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                    ),
                  ),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
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
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: Text('Tiendas cerca de ti', style: displayStyle(size: 22, color: colors.textPrimary)),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: _loading
                ? Center(child: CircularProgressIndicator(color: colors.brand))
                : _error != null
                    ? Center(child: Text(_error!, style: TextStyle(color: colors.textMuted)))
                    : stores.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(32),
                              child: Column(mainAxisSize: MainAxisSize.min, children: [
                                Container(
                                  width: 64,
                                  height: 64,
                                  decoration: BoxDecoration(shape: BoxShape.circle, color: colors.brandSoft),
                                  child: Icon(Icons.storefront_outlined, size: 30, color: colors.brand),
                                ),
                                const SizedBox(height: 14),
                                Text('No hay tiendas por aquí todavía',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w700, fontSize: 16)),
                                const SizedBox(height: 4),
                                Text('Prueba con otra ciudad o categoría.',
                                    textAlign: TextAlign.center, style: TextStyle(color: colors.textMuted)),
                              ]),
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _load,
                            color: colors.brand,
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                              itemCount: stores.length,
                              separatorBuilder: (_, _) => const SizedBox(height: 16),
                              itemBuilder: (_, i) => _StoreTile(store: stores[i], onTap: () => _openStore(stores[i])),
                            ),
                          ),
          ),
        ]),
      ),
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
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: Material(
        color: selected ? colors.brand : colors.surface,
        shape: StadiumBorder(side: BorderSide(color: selected ? Colors.transparent : colors.border)),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Center(
              child: Text(
                label,
                style: TextStyle(
                  color: selected ? colors.onBrand : colors.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
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
    final accent = hexToColor(store.designConfig['color'] as String? ?? '#0A9F5B');
    final darker = Color.lerp(accent, Colors.black, 0.35)!;
    final expiresAt = store.expiresAt != null ? DateTime.tryParse(store.expiresAt!) : null;
    final daysLeft = expiresAt?.difference(DateTime.now()).inDays;
    final isUrgent = daysLeft != null && daysLeft <= 7;
    final icon = store.designConfig['stamp_icon'] as String? ?? '🏪';
    final total = store.stampsRequired.clamp(1, 10);

    return AppCard(
      padding: EdgeInsets.zero,
      radius: 28,
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            height: 128,
            decoration: BoxDecoration(
              gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [accent, darker]),
            ),
            child: Stack(children: [
              Positioned(right: -24, top: -30, child: Container(width: 140, height: 140, decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.14)))),
              if (store.avatarUrl != null)
                Positioned.fill(
                  child: Opacity(
                    opacity: 0.35,
                    child: Image.network(store.avatarUrl!, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox()),
                  ),
                ),
              Positioned(
                left: 14,
                top: 14,
                child: _CoverPill(text: store.category ?? 'Tienda', dark: true),
              ),
              if (store.distanceKm != null)
                Positioned(
                  right: 14,
                  top: 14,
                  child: _CoverPill(
                    text: store.distanceKm! < 1 ? '${(store.distanceKm! * 1000).round()} m' : '${store.distanceKm!.toStringAsFixed(1)} km',
                    dark: false,
                  ),
                ),
              Positioned(
                left: 18,
                bottom: 16,
                child: Row(children: [
                  for (var i = 0; i < total; i++)
                    Container(
                      width: 22,
                      height: 22,
                      margin: const EdgeInsets.only(right: 6),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: i < (total * 0.6).round() ? Colors.white : Colors.transparent,
                        border: Border.all(color: Colors.white.withValues(alpha: 0.75), width: 2),
                      ),
                    ),
                ]),
              ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
            child: Row(children: [
              Transform.translate(
                offset: const Offset(0, -18),
                child: Container(
                  width: 52,
                  height: 52,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    gradient: LinearGradient(colors: [accent, darker]),
                    border: Border.all(color: colors.surface, width: 4),
                  ),
                  child: Text(icon, style: const TextStyle(fontSize: 22)),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: 14),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(store.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: displayStyle(size: 19, color: colors.textPrimary)),
                    const SizedBox(height: 3),
                    Text(store.benefitDescription, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: colors.textMuted, fontSize: 13)),
                    if (isUrgent) ...[
                      const SizedBox(height: 4),
                      Text('Vence en $daysLeft ${daysLeft == 1 ? 'día' : 'días'}',
                          style: TextStyle(color: colors.coral, fontSize: 11, fontWeight: FontWeight.w700)),
                    ],
                  ]),
                ),
              ),
              const SizedBox(width: 10),
              Padding(
                padding: const EdgeInsets.only(top: 14),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(color: colors.brand, borderRadius: BorderRadius.circular(999)),
                  child: Text('Unirme', style: TextStyle(color: colors.onBrand, fontSize: 13, fontWeight: FontWeight.w800)),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _CoverPill extends StatelessWidget {
  const _CoverPill({required this.text, required this.dark});
  final String text;
  final bool dark;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: dark ? const Color(0x8C12161C) : const Color(0xEBFFFFFF),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(text, style: TextStyle(color: dark ? Colors.white : const Color(0xFF12161C), fontSize: 12, fontWeight: FontWeight.w800)),
      );
}
