import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../data/mobile_api_client.dart';
import 'widgets/card_preview_widget.dart';

const _icons = ['⭐', '☕', '🍕', '🥖', '🍔', '🍦', '🎯', '💎', '🔥', '🌟', '🎁', '🏆',
                 '🎵', '🏋️', '🐾', '🌸', '🍣', '🍜', '🧁', '🎮'];

const _accentColors = [
  '#00C896', '#3B82F6', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#10B981', '#F97316',
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

  int _stamps = 8;
  String _icon = '⭐';
  String _color = '#00C896';
  String _bgType = 'solid';
  String _bgValue = '#0f172a';
  String? _logoUrl;
  bool _multiRewards = false;
  bool _hasExpiry = false;
  DateTime? _expiresAt;
  List<_RewardEntry> _rewards = [_RewardEntry(stamps: 5, label: '', color: '#00C896')];
  bool _saving = false;
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
      _bgType = c.bgType;
      _bgValue = c.bgValue;
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
  }

  @override
  void dispose() {
    _name.dispose();
    _benefit.dispose();
    _bgTabController.dispose();
    super.dispose();
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
      'stamp_icon': _icon,
      'color': _color,
      'bg_type': _bgType,
      'bg_value': _bgValue,
      'bg_image_url': null,
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
        decoration: const BoxDecoration(
          color: Color(0xFF0F172A),
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 4),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    widget.existing != null ? 'Editar tarjeta' : 'Nueva tarjeta',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 18),
                  ),
                  TextButton(
                    onPressed: _saving ? null : _save,
                    child: _saving
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Guardar', style: TextStyle(color: Color(0xFF00C896), fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Text(_error!, style: const TextStyle(color: Color(0xFFEF4444), fontSize: 12)),
              ),
            Expanded(
              child: ListView(
                controller: controller,
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                children: [
                  CardPreviewWidget(
                    name: _name.text,
                    stampIcon: _icon,
                    color: _color,
                    bgType: _bgType,
                    bgValue: _bgValue,
                    bgImageUrl: null,
                    logoUrl: _logoUrl,
                    multiRewards: _multiRewards,
                    rewards: _rewards
                        .map((r) => CardRewardModel(
                              id: '',
                              stampsRequired: r.stamps,
                              rewardLabel: r.label.isEmpty ? 'Premio' : r.label,
                              color: r.color,
                              sortOrder: 0,
                            ))
                        .toList(),
                    stampsRequired: _stamps,
                    benefitDescription: _benefit.text,
                  ),
                  const SizedBox(height: 24),

                  _label('Nombre de la tarjeta'),
                  _field(_name, 'ej. Tarjeta Café'),
                  const SizedBox(height: 16),

                  _label('Sellos para completar'),
                  Row(
                    children: [
                      _iconBtn(Icons.remove, () => setState(() => _stamps = (_stamps - 1).clamp(2, 50))),
                      const SizedBox(width: 16),
                      Text('$_stamps', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
                      const SizedBox(width: 16),
                      _iconBtn(Icons.add, () => setState(() => _stamps = (_stamps + 1).clamp(2, 50))),
                    ],
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
                              ? const Color(0xFF00C896).withValues(alpha: 0.2)
                              : Colors.white.withValues(alpha: 0.04),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: _icon == ic ? const Color(0xFF00C896) : Colors.transparent,
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
                            border: selected ? Border.all(color: Colors.white, width: 2.5) : null,
                            boxShadow: selected ? [BoxShadow(color: Colors.white.withValues(alpha: 0.3), blurRadius: 4)] : null,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),

                  _label('Logo del negocio (opcional)'),
                  GestureDetector(
                    onTap: _pickLogo,
                    child: Container(
                      height: 56,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.04),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: _logoUrl != null ? 0.2 : 0.08),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            _logoUrl != null ? Icons.check_circle_outline : Icons.upload_outlined,
                            color: _logoUrl != null ? const Color(0xFF00C896) : Colors.white38,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _logoUrl != null ? 'Logo subido ✓ — toca para cambiar' : 'Subir logo (PNG, JPG, WebP)',
                            style: TextStyle(
                              color: _logoUrl != null ? const Color(0xFF00C896) : Colors.white38,
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
                      style: TextButton.styleFrom(foregroundColor: const Color(0xFF00C896)),
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
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text,
            style: TextStyle(
                color: Colors.white.withValues(alpha: 0.5),
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.8)),
      );

  Widget _field(TextEditingController ctrl, String hint) => TextField(
        controller: ctrl,
        onChanged: (_) => setState(() {}),
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3)),
          filled: true,
          fillColor: Colors.white.withValues(alpha: 0.04),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.1)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF00C896)),
          ),
        ),
      );

  Widget _iconBtn(IconData icon, VoidCallback onTap) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: Colors.white70, size: 18),
        ),
      );

  Widget _toggleRow(String title, String subtitle, bool value, void Function(bool) onChanged) =>
      Container(
        padding: const EdgeInsets.all(14),
        margin: const EdgeInsets.only(bottom: 4),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 2),
                Text(subtitle, style: TextStyle(color: Colors.white.withValues(alpha: 0.45), fontSize: 11)),
              ]),
            ),
            Switch(
              value: value,
              onChanged: onChanged,
              activeThumbColor: const Color(0xFF00C896),
            ),
          ],
        ),
      );
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
        color: Colors.white.withValues(alpha: 0.04),
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
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Premio nivel ${widget.index + 1}',
                hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3), fontSize: 13),
                isDense: true,
                border: InputBorder.none,
              ),
            ),
          ),
          Row(
            children: [
              InkWell(
                onTap: () => setState(() { widget.entry.stamps = (widget.entry.stamps - 1).clamp(1, 200); widget.onChanged(); }),
                child: const Icon(Icons.remove_circle_outline, color: Colors.white38, size: 18),
              ),
              const SizedBox(width: 4),
              InkWell(
                onTap: () => setState(() { widget.entry.stamps = (widget.entry.stamps + 1).clamp(1, 200); widget.onChanged(); }),
                child: const Icon(Icons.add_circle_outline, color: Colors.white38, size: 18),
              ),
            ],
          ),
          if (widget.onRemove != null) ...[
            const SizedBox(width: 4),
            InkWell(
              onTap: widget.onRemove,
              child: const Icon(Icons.close, color: Colors.white24, size: 18),
            ),
          ],
        ],
      ),
    );
  }
}
