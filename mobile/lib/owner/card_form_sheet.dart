import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../data/mobile_api_client.dart';
import '../core/app_colors.dart';
import '../core/theme.dart';
import '../shared/wallet_preview_card.dart';

// Matches src/components/cards/card-editor.tsx's EMOJIS/PALETTE exactly, so
// a card looks the same regardless of which client created it.
const _icons = ['☕','🍕','🌮','🍔','🎂','✂️','🛍️','💈','🍦','🥐',
                 '🍣','🎯','💪','📚','🌸','🎵','🍷','🧁','🏋️','🎨',
                 '🐾','🧘','🚀','⭐','🍫','🥗','🎮','🏥','🐕','🌿'];

const _accentColors = [
  '#1d4ed8', '#0f766e', '#7c3aed', '#dc2626',
  '#d97706', '#16a34a', '#db2777', '#0ea5e9',
  '#111827', '#f97316', '#be185d', '#059669',
];

const _styles = [
  (value: CardStyle.clean, label: 'Clean', desc: 'Loyalz · Minimal'),
  (value: CardStyle.modern, label: 'Modern', desc: 'Apple · Revolut'),
  (value: CardStyle.luxury, label: 'Luxury', desc: 'Amex · VIP'),
  (value: CardStyle.editorial, label: 'Editorial', desc: 'Boarding pass'),
  (value: CardStyle.minimal, label: 'Minimal', desc: 'Notion · Linear'),
];

class CardFormSheet extends StatefulWidget {
  final LoyaltyCardModel? existing;
  final VoidCallback onSaved;
  const CardFormSheet({super.key, this.existing, required this.onSaved});

  @override
  State<CardFormSheet> createState() => _CardFormSheetState();
}

class _CardFormSheetState extends State<CardFormSheet>
    with SingleTickerProviderStateMixin {
  final _name = TextEditingController();
  final _benefit = TextEditingController();
  final _hexInput = TextEditingController();

  int _stamps = 8;
  String _icon = '⭐';
  String _color = '#00C896';
  CardStyle _style = CardStyle.clean;
  String _bgMode = 'light';
  int _pushThreshold = 1;
  String _bgType = 'solid';
  String? _bgImageUrl;
  String? _logoUrl;
  bool _multiRewards = false;
  bool _hasExpiry = false;
  DateTime? _expiresAt;
  List<_RewardEntry> _rewards = [_RewardEntry(stamps: 5, label: '', color: '#00C896')];
  bool _saving = false;
  bool _uploadingBg = false;
  String? _error;

  late TabController _bgTabController;
  final _api = MobileApiClient();

  @override
  void initState() {
    super.initState();
    _bgTabController = TabController(length: 2, vsync: this);
    final c = widget.existing;
    if (c != null) {
      _name.text = c.name;
      _benefit.text = c.benefitDescription;
      _stamps = c.stampsRequired;
      _icon = c.stampIcon;
      _color = c.color;
      _style = cardStyleFromString(c.style);
      _bgMode = c.bgMode;
      _pushThreshold = c.pushNotifyThreshold;
      _bgType = c.bgType;
      _bgImageUrl = c.bgImageUrl;
      _logoUrl = c.logoUrl;
      _multiRewards = c.multiRewards;
      if (c.expiresAt != null) {
        _hasExpiry = true;
        _expiresAt = DateTime.tryParse(c.expiresAt!);
      }
      if (c.rewards.isNotEmpty) {
        _rewards = c.rewards
            .map((r) => _RewardEntry(stamps: r.stampsRequired, label: r.rewardLabel, color: r.color))
            .toList();
      }
      if (_bgType == 'image') _bgTabController.index = 1;
    }
    _hexInput.text = _color;
  }

  @override
  void dispose() {
    _name.dispose();
    _benefit.dispose();
    _hexInput.dispose();
    _bgTabController.dispose();
    super.dispose();
  }

  Future<void> _pickBackground() async {
    final picker = ImagePicker();
    final img = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (img == null) return;
    final bytes = await img.readAsBytes();
    final mimeType = img.mimeType ?? 'image/jpeg';
    setState(() => _uploadingBg = true);
    try {
      final url = await _api.uploadBackground(bytes, mimeType);
      setState(() { _bgImageUrl = url; _uploadingBg = false; });
    } catch (e) {
      setState(() { _error = 'Error al subir foto de fondo'; _uploadingBg = false; });
    }
  }

  Future<void> _pickLogo() async {
    final picker = ImagePicker();
    final img = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (img == null) return;
    final bytes = await img.readAsBytes();
    final mimeType = img.mimeType ?? 'image/jpeg';
    try {
      final url = await _api.uploadLogo(bytes, mimeType);
      setState(() => _logoUrl = url);
    } catch (e) {
      setState(() => _error = 'Error al subir logo');
    }
  }

  List<Map<String, dynamic>> get _rewardsJson => _rewards
      .map((r) => {'stamps_required': r.stamps, 'reward_label': r.label, 'color': r.color})
      .toList();

  Future<void> _save() async {
    final name = _name.text.trim();
    final benefit = _benefit.text.trim();
    if (name.isEmpty) { setState(() => _error = 'Ingresa un nombre'); return; }
    if (benefit.isEmpty) { setState(() => _error = 'Ingresa el premio base'); return; }
    if (_multiRewards) {
      for (final r in _rewards) {
        if (r.label.isEmpty) { setState(() => _error = 'Todos los niveles necesitan descripción'); return; }
      }
    }

    setState(() { _saving = true; _error = null; });

    final body = {
      'name': name,
      'stamps_required': _stamps,
      'benefit_description': benefit,
      'push_notify_threshold': _pushThreshold,
      'stamp_icon': _icon,
      'color': _color,
      'style': cardStyleToString(_style),
      'bg_mode': _bgMode,
      'bg_type': _bgType == 'image' && _bgImageUrl != null ? 'image' : 'solid',
      'bg_value': _color,
      'bg_image_url': _bgType == 'image' ? _bgImageUrl : null,
      'font': 'default',
      'logo_url': _logoUrl,
      'expires_at': _hasExpiry && _expiresAt != null ? _expiresAt!.toIso8601String() : null,
      'multi_rewards': _multiRewards,
      'rewards': _multiRewards ? _rewardsJson : [],
    };

    try {
      final Map<String, dynamic> res;
      if (widget.existing != null) {
        res = await _api.patch('/api/mobile/cards/${widget.existing!.id}', body);
      } else {
        res = await _api.post('/api/mobile/cards', body);
      }
      if (res.containsKey('error')) {
        setState(() { _error = res['error'] as String? ?? 'Error al guardar'; _saving = false; });
        return;
      }
      if (mounted) { Navigator.pop(context); widget.onSaved(); }
    } catch (e) {
      setState(() { _error = 'Error al guardar'; _saving = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.95,
      maxChildSize: 0.97,
      minChildSize: 0.5,
      expand: false,
      builder: (_, controller) => Container(
        decoration: BoxDecoration(
          color: context.colors.bg,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
        ),
        child: Column(
          children: [
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 4),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: context.colors.divider,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.existing != null ? 'Editar tarjeta' : 'Nueva tarjeta',
                      style: displayStyle(size: 24, color: context.colors.textPrimary),
                    ),
                  ),
                  SizedBox(
                    height: 44,
                    child: ElevatedButton(
                      onPressed: _saving ? null : _save,
                      style: ElevatedButton.styleFrom(minimumSize: const Size(110, 44), padding: const EdgeInsets.symmetric(horizontal: 22)),
                      child: _saving
                          ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: context.colors.onBrand))
                          : const Text('Guardar'),
                    ),
                  ),
                ],
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Text(_error!, style: TextStyle(color: context.colors.coral, fontSize: 13, fontWeight: FontWeight.w600)),
              ),
            Expanded(
              child: ListView(
                controller: controller,
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                children: [
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(28),
                      gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [context.colors.brandSoft, context.colors.surfaceAlt]),
                      border: Border.all(color: context.colors.border),
                    ),
                    child: WalletPreviewCard(
                    businessName: '',
                    name: _name.text,
                    benefitDescription: _benefit.text,
                    stampsRequired: _stamps,
                    stampIcon: _icon,
                    color: hexToColor(_color),
                    cardStyle: _style,
                    bgMode: _bgMode,
                    bgType: _bgType,
                    bgImageUrl: _bgImageUrl,
                    logoUrl: _logoUrl,
                    filledStamps: (_stamps * 0.6).ceil().clamp(0, _stamps),
                  ),
                  ),
                  const SizedBox(height: 24),

                  _label('Estilo de tarjeta'),
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 1.25,
                    children: _styles.map((st) {
                      final selected = _style == st.value;
                      return InkWell(
                        onTap: () => setState(() => _style = st.value),
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: selected ? context.colors.brand : context.colors.border, width: selected ? 2 : 1),
                            color: selected ? context.colors.brandSoft : context.colors.surface,
                          ),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Expanded(child: _StyleThumb(style: st.value, color: hexToColor(_color))),
                            const SizedBox(height: 6),
                            Row(children: [
                              Expanded(
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(st.label, style: TextStyle(color: context.colors.textPrimary, fontWeight: FontWeight.w800, fontSize: 13)),
                                  Text(st.desc, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: context.colors.textMuted, fontSize: 10)),
                                ]),
                              ),
                              if (selected) Icon(Icons.check_circle_rounded, color: context.colors.brand, size: 20),
                            ]),
                          ]),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),

                  _label('Nombre de la tarjeta'),
                  _field(_name, 'ej. Tarjeta Café'),
                  const SizedBox(height: 16),

                  _label('Sellos para completar'),
                  Row(
                    children: [
                      _iconBtn(Icons.remove, () => setState(() => _stamps = (_stamps - 1).clamp(2, 50))),
                      const SizedBox(width: 16),
                      Text('$_stamps', style: TextStyle(color: context.colors.textPrimary, fontSize: 22, fontWeight: FontWeight.w700)),
                      const SizedBox(width: 16),
                      _iconBtn(Icons.add, () => setState(() => _stamps = (_stamps + 1).clamp(2, 50))),
                    ],
                  ),
                  const SizedBox(height: 16),

                  _label('Avisar por push cuando falte${_pushThreshold == 1 ? '' : 'n'}: $_pushThreshold sello${_pushThreshold == 1 ? '' : 's'}'),
                  Row(
                    children: [
                      _iconBtn(Icons.remove, () => setState(() => _pushThreshold = (_pushThreshold - 1).clamp(1, 5))),
                      const SizedBox(width: 16),
                      Text('$_pushThreshold', style: TextStyle(color: context.colors.textPrimary, fontSize: 22, fontWeight: FontWeight.w700)),
                      const SizedBox(width: 16),
                      _iconBtn(Icons.add, () => setState(() => _pushThreshold = (_pushThreshold + 1).clamp(1, 5))),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('Solo aplica si tu plan incluye notificaciones push (Pro/Premium).',
                        style: TextStyle(color: context.colors.textMuted, fontSize: 11)),
                  ),
                  const SizedBox(height: 16),

                  _label('Ícono del sello'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _icons.map((ic) => GestureDetector(
                      onTap: () => setState(() => _icon = ic),
                      child: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: _icon == ic
                              ? const Color(0xFF0A9F5B).withValues(alpha: 0.2)
                              : context.colors.surfaceAlt,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: _icon == ic ? const Color(0xFF0A9F5B) : Colors.transparent,
                            width: 1.5,
                          ),
                        ),
                        child: Center(child: Text(ic, style: const TextStyle(fontSize: 20))),
                      ),
                    )).toList(),
                  ),
                  const SizedBox(height: 16),

                  _label('Color del acento'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _accentColors.map((hex) {
                      final selected = _color == hex;
                      final parsed = int.tryParse('FF${hex.replaceAll('#', '')}', radix: 16) ?? 0xFF00C896;
                      return GestureDetector(
                        onTap: () => setState(() => _color = hex),
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: Color(parsed),
                            shape: BoxShape.circle,
                            border: selected ? Border.all(color: context.colors.textPrimary, width: 2.5) : null,
                            boxShadow: selected ? [BoxShadow(color: context.colors.textPrimary.withValues(alpha: 0.3), blurRadius: 4)] : null,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _hexInput,
                    onChanged: (v) {
                      if (RegExp(r'^#[0-9A-Fa-f]{0,6}$').hasMatch(v)) setState(() => _color = v);
                    },
                    style: TextStyle(color: context.colors.textPrimary, fontSize: 13, fontFamily: 'monospace'),
                    decoration: InputDecoration(
                      hintText: '#1d4ed8',
                      hintStyle: TextStyle(color: context.colors.textMuted, fontFamily: 'monospace'),
                      isDense: true,
                    ),
                  ),
                  const SizedBox(height: 16),

                  if (_style == CardStyle.clean) ...[
                    _label('Modo'),
                    Row(children: [
                      _seg('Claro', _bgMode == 'light', () => setState(() => _bgMode = 'light')),
                      _seg('Oscuro', _bgMode == 'dark', () => setState(() => _bgMode = 'dark'))
                    ]),
                    const SizedBox(height: 16),
                  ],

                  _label('Foto de fondo (opcional)'),
                  Row(children: [
                      _seg('Color', _bgType == 'solid', () => setState(() => _bgType = 'solid')),
                      _seg('Foto', _bgType == 'image', () => setState(() => _bgType = 'image'))
                    ]),
                  if (_bgType == 'image') ...[
                    const SizedBox(height: 8),
                    GestureDetector(
                      onTap: _uploadingBg ? null : _pickBackground,
                      child: Container(
                        height: 56,
                        decoration: BoxDecoration(
                          color: context.colors.surfaceAlt,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: _bgImageUrl != null ? const Color(0xFF0A9F5B).withValues(alpha: 0.3) : context.colors.border),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if (_uploadingBg)
                              const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                            else
                              Icon(_bgImageUrl != null ? Icons.check_circle_outline : Icons.upload_outlined,
                                  color: _bgImageUrl != null ? const Color(0xFF0A9F5B) : context.colors.textMuted, size: 20),
                            const SizedBox(width: 8),
                            Text(
                              _bgImageUrl != null ? 'Foto subida ✓ — toca para cambiar' : 'Subir foto de fondo',
                              style: TextStyle(color: _bgImageUrl != null ? const Color(0xFF0A9F5B) : context.colors.textMuted, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),

                  _label('Logo del negocio (opcional)'),
                  GestureDetector(
                    onTap: _pickLogo,
                    child: Container(
                      height: 56,
                      decoration: BoxDecoration(
                        color: context.colors.surfaceAlt,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _logoUrl != null ? const Color(0xFF0A9F5B).withValues(alpha: 0.3) : context.colors.border,
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _logoUrl != null ? Icons.check_circle_outline : Icons.upload_outlined,
                            color: _logoUrl != null ? const Color(0xFF0A9F5B) : context.colors.textMuted,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _logoUrl != null ? 'Logo subido ✓ — toca para cambiar' : 'Subir logo (PNG, JPG, WebP)',
                            style: TextStyle(
                              color: _logoUrl != null ? const Color(0xFF0A9F5B) : context.colors.textMuted,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  _label('Premio (nivel base)'),
                  _field(_benefit, 'ej. Café gratis'),
                  const SizedBox(height: 20),

                  _toggleRow(
                    '🏆  Multi-nivel de premios',
                    'Recompensas en distintos puntos del camino',
                    _multiRewards,
                    (v) => setState(() => _multiRewards = v),
                  ),
                  if (_multiRewards) ...[
                    const SizedBox(height: 12),
                    ..._rewards.asMap().entries.map((e) => _RewardTile(
                          entry: e.value,
                          index: e.key,
                          onChanged: () => setState(() {}),
                          onRemove: _rewards.length > 1
                              ? () => setState(() => _rewards.removeAt(e.key))
                              : null,
                        )),
                    TextButton.icon(
                      onPressed: _rewards.length < 5
                          ? () => setState(() => _rewards.add(_RewardEntry(
                                stamps: (_rewards.last.stamps + 5).clamp(1, 200),
                                label: '',
                                color: _accentColors[_rewards.length % _accentColors.length],
                              )))
                          : null,
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Agregar nivel'),
                      style: TextButton.styleFrom(foregroundColor: const Color(0xFF0A9F5B)),
                    ),
                  ],
                  const SizedBox(height: 8),

                  _toggleRow(
                    '📅  Vigencia',
                    _hasExpiry && _expiresAt != null
                        ? 'Vence el ${_expiresAt!.day}/${_expiresAt!.month}/${_expiresAt!.year}'
                        : 'Sin fecha de vencimiento',
                    _hasExpiry,
                    (v) async {
                      if (v) {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: DateTime.now().add(const Duration(days: 365)),
                          firstDate: DateTime.now().add(const Duration(days: 1)),
                          lastDate: DateTime.now().add(const Duration(days: 365 * 5)),
                        );
                        if (picked != null) setState(() { _hasExpiry = true; _expiresAt = picked; });
                      } else {
                        setState(() { _hasExpiry = false; _expiresAt = null; });
                      }
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Text(text,
            style: TextStyle(color: context.colors.textSecondary, fontSize: 14, fontWeight: FontWeight.w700)),
      );

  Widget _seg(String label, bool selected, VoidCallback onTap) => Expanded(
        child: Padding(
          padding: const EdgeInsets.only(right: 8),
          child: Material(
            color: selected ? context.colors.brand : context.colors.surface,
            shape: StadiumBorder(side: BorderSide(color: selected ? Colors.transparent : context.colors.border)),
            child: InkWell(
              customBorder: const StadiumBorder(),
              onTap: onTap,
              child: SizedBox(
                height: 44,
                child: Center(
                  child: Text(label,
                      style: TextStyle(color: selected ? context.colors.onBrand : context.colors.textPrimary, fontWeight: FontWeight.w800, fontSize: 14)),
                ),
              ),
            ),
          ),
        ),
      );

  Widget _field(TextEditingController ctrl, String hint) => TextField(
        controller: ctrl,
        onChanged: (_) => setState(() {}),
        style: TextStyle(color: context.colors.textPrimary),
        decoration: InputDecoration(hintText: hint),
      );

  Widget _iconBtn(IconData icon, VoidCallback onTap) => Material(
        color: context.colors.brandSoft,
        shape: const CircleBorder(),
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: SizedBox(width: 44, height: 44, child: Icon(icon, color: context.colors.brand, size: 22)),
        ),
      );

  Widget _toggleRow(String title, String subtitle, bool value, void Function(bool) onChanged) =>
      Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: context.colors.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: TextStyle(color: context.colors.textPrimary, fontWeight: FontWeight.w700, fontSize: 14)),
                const SizedBox(height: 2),
                Text(subtitle, style: TextStyle(color: context.colors.textMuted, fontSize: 12)),
              ]),
            ),
            Switch(
              value: value,
              onChanged: onChanged,
              activeThumbColor: Colors.white,
              activeTrackColor: context.colors.brand,
            ),
          ],
        ),
      );
}

/// Miniatura ilustrativa de cada estilo de tarjeta.
class _StyleThumb extends StatelessWidget {
  const _StyleThumb({required this.style, required this.color});
  final CardStyle style;
  final Color color;

  Widget _dots(Color on, Color off) => Row(children: [
        for (var i = 0; i < 4; i++)
          Container(width: 12, height: 12, margin: const EdgeInsets.only(right: 5), decoration: BoxDecoration(shape: BoxShape.circle, color: i < 2 ? on : off)),
      ]);

  @override
  Widget build(BuildContext context) {
    Color bg1 = color;
    Color bg2 = color.withValues(alpha: 0.75);
    Color bar = Colors.white.withValues(alpha: 0.85);
    Color on = Colors.white;
    Color off = Colors.white.withValues(alpha: 0.3);
    Border? border;
    switch (style) {
      case CardStyle.modern:
        bg1 = const Color(0xFF12161C);
        bg2 = Color.alphaBlend(color.withValues(alpha: 0.4), const Color(0xFF12161C));
        on = color;
        off = Colors.white.withValues(alpha: 0.18);
      case CardStyle.luxury:
        bg1 = bg2 = const Color(0xFF0B0B0B);
        bar = on = const Color(0xFFC9A227);
        off = const Color(0x33C9A227);
        border = Border.all(color: const Color(0x55C9A227));
      case CardStyle.editorial:
        bg1 = bg2 = const Color(0xFFF2ECE0);
        bar = on = color;
        off = const Color(0x1F000000);
      case CardStyle.minimal:
        bg1 = bg2 = Colors.white;
        bar = const Color(0xB3000000);
        on = color;
        off = const Color(0x1A000000);
        border = Border.all(color: const Color(0x1A000000));
      default:
        break;
    }
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [bg1, bg2]),
        border: border,
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Container(width: 34, height: 5, decoration: BoxDecoration(color: bar, borderRadius: BorderRadius.circular(3))),
        _dots(on, off),
      ]),
    );
  }
}

class _RewardEntry {
  int stamps;
  String label;
  String color;
  _RewardEntry({required this.stamps, required this.label, required this.color});
}

class _RewardTile extends StatefulWidget {
  final _RewardEntry entry;
  final int index;
  final VoidCallback onChanged;
  final VoidCallback? onRemove;

  const _RewardTile({
    required this.entry,
    required this.index,
    required this.onChanged,
    this.onRemove,
  });

  @override
  State<_RewardTile> createState() => _RewardTileState();
}

class _RewardTileState extends State<_RewardTile> {
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.entry.label);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final parsed = int.tryParse('FF${widget.entry.color.replaceAll('#', '')}', radix: 16) ?? 0xFF00C896;
    final barColor = Color(parsed);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: context.colors.surfaceAlt,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: barColor.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: barColor.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text('${widget.entry.stamps}✦',
                style: TextStyle(color: barColor, fontWeight: FontWeight.w700, fontSize: 12)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: _ctrl,
              onChanged: (v) { widget.entry.label = v; widget.onChanged(); },
              style: TextStyle(color: context.colors.textPrimary, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Premio nivel ${widget.index + 1}',
                hintStyle: TextStyle(color: context.colors.textMuted, fontSize: 13),
                isDense: true,
                border: InputBorder.none,
              ),
            ),
          ),
          Row(
            children: [
              InkWell(
                onTap: () => setState(() { widget.entry.stamps = (widget.entry.stamps - 1).clamp(1, 200); widget.onChanged(); }),
                child: Icon(Icons.remove_circle_outline, color: context.colors.textMuted, size: 18),
              ),
              const SizedBox(width: 4),
              InkWell(
                onTap: () => setState(() { widget.entry.stamps = (widget.entry.stamps + 1).clamp(1, 200); widget.onChanged(); }),
                child: Icon(Icons.add_circle_outline, color: context.colors.textMuted, size: 18),
              ),
            ],
          ),
          if (widget.onRemove != null) ...[
            const SizedBox(width: 4),
            InkWell(
              onTap: widget.onRemove,
              child: Icon(Icons.close, color: context.colors.textMuted, size: 18),
            ),
          ],
        ],
      ),
    );
  }
}
