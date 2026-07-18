import 'package:flutter/material.dart';
import '../data/mobile_api_client.dart';

class OwnerSettingsScreen extends StatefulWidget {
  const OwnerSettingsScreen({super.key});
  @override
  State<OwnerSettingsScreen> createState() => _OwnerSettingsScreenState();
}

class _OwnerSettingsScreenState extends State<OwnerSettingsScreen> {
  final _name = TextEditingController();
  final _address = TextEditingController();
  final _geofenceMessageCtrl = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _success;
  int _cooldown = 0;
  String _plan = 'free';

  // Geofence state
  bool _geofenceEnabled = false;
  int _geofenceRadiusM = 300;
  int _geofenceCooldownH = 24;
  int _quietHoursStart = 22;
  int _quietHoursEnd = 6;

  static const _cooldownOptions = [
    (label: 'Sin cooldown', value: 0),
    (label: '1 minuto', value: 60),
    (label: '5 minutos', value: 300),
    (label: '15 minutos', value: 900),
    (label: '1 hora', value: 3600),
    (label: '1 día', value: 86400),
  ];

  static const _geoCooldownOptions = [
    (label: '1 hora', value: 1),
    (label: '6 horas', value: 6),
    (label: '12 horas', value: 12),
    (label: '24 horas', value: 24),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _address.dispose();
    _geofenceMessageCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final s = await MobileApiClient().getSettings();
      setState(() {
        _name.text = s.name;
        _address.text = s.address ?? '';
        _cooldown = s.stampCooldownSeconds;
        _plan = s.plan;
        _geofenceEnabled = s.geofenceEnabled;
        _geofenceRadiusM = s.geofenceRadiusM;
        _geofenceMessageCtrl.text = s.geofenceMessage;
        _geofenceCooldownH = s.geofenceCooldownH;
        _quietHoursStart = s.quietHoursStart;
        _quietHoursEnd = s.quietHoursEnd;
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = 'Error al cargar ajustes'; _loading = false; });
    }
  }

  Future<void> _save() async {
    setState(() { _saving = true; _error = null; _success = null; });
    try {
      final body = <String, dynamic>{
        'name': _name.text.trim(),
        'address': _address.text.trim().isEmpty ? null : _address.text.trim(),
        'stamp_cooldown_seconds': _cooldown,
      };
      if (_isPro) {
        body['geofence_enabled'] = _geofenceEnabled;
        body['geofence_radius_m'] = _geofenceRadiusM;
        body['geofence_message'] = _geofenceMessageCtrl.text.trim().isEmpty
            ? null
            : _geofenceMessageCtrl.text.trim();
        body['geofence_cooldown_h'] = _geofenceCooldownH;
        body['quiet_hours_start'] = _quietHoursStart;
        body['quiet_hours_end'] = _quietHoursEnd;
      }
      final res = await MobileApiClient().patch('/api/mobile/settings', body);
      if (res.containsKey('error')) {
        setState(() { _error = res['error'] as String? ?? 'Error al guardar'; _saving = false; });
        return;
      }
      setState(() { _success = 'Ajustes guardados'; _saving = false; });
    } catch (e) {
      setState(() { _error = 'Error de conexión'; _saving = false; });
    }
  }

  String _fmt(int h) => '${h.toString().padLeft(2, '0')}:00';

  Future<void> _pickTime(bool isStart) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: isStart ? _quietHoursStart : _quietHoursEnd, minute: 0),
    );
    if (picked != null) {
      setState(() {
        if (isStart) { _quietHoursStart = picked.hour; }
        else { _quietHoursEnd = picked.hour; }
      });
    }
  }

  bool get _isPro => ['pro', 'premium'].contains(_plan);

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    return Scaffold(
      appBar: AppBar(title: const Text('Ajustes')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Datos del negocio ──────────────────────────────────────────
            _sectionHeader('Datos del negocio'),
            _field('Nombre del negocio', _name),
            const SizedBox(height: 12),
            _field('Dirección', _address),
            const SizedBox(height: 24),

            // ── Cooldown de sellos ─────────────────────────────────────────
            _sectionHeader('Cooldown de sellos'),
            DropdownButtonFormField<int>(
              initialValue: _cooldown,
              decoration: _inputDeco('Tiempo entre sellos'),
              items: _cooldownOptions
                  .map((o) => DropdownMenuItem(value: o.value, child: Text(o.label)))
                  .toList(),
              onChanged: (v) => setState(() => _cooldown = v ?? 0),
            ),
            const SizedBox(height: 24),

            // ── Notificaciones de proximidad ───────────────────────────────
            _sectionHeader('Notificaciones de proximidad'),
            if (!_isPro)
              _proBadge()
            else ...[
              SwitchListTile(
                value: _geofenceEnabled,
                onChanged: (v) => setState(() => _geofenceEnabled = v),
                title: const Text('Activar notificaciones al acercarse'),
                subtitle: const Text('El cliente recibe un push al entrar al radio'),
                contentPadding: EdgeInsets.zero,
              ),
              if (_geofenceEnabled) ...[
                const SizedBox(height: 16),
                const Text('Radio de detección',
                    style: TextStyle(fontSize: 13, color: Colors.white70)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: [100, 300, 500].map((r) => ChoiceChip(
                    label: Text('${r}m'),
                    selected: _geofenceRadiusM == r,
                    onSelected: (_) => setState(() => _geofenceRadiusM = r),
                  )).toList(),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _geofenceMessageCtrl,
                  decoration: _inputDeco('Mensaje personalizado (opcional)'),
                  maxLength: 120,
                ),
                const SizedBox(height: 16),
                const Text('Sin notificaciones de noche',
                    style: TextStyle(fontSize: 13, color: Colors.white70)),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _pickTime(true),
                      child: Text('Desde ${_fmt(_quietHoursStart)}'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => _pickTime(false),
                      child: Text('Hasta ${_fmt(_quietHoursEnd)}'),
                    ),
                  ),
                ]),
                const SizedBox(height: 16),
                DropdownButtonFormField<int>(
                  initialValue: _geoCooldownOptions.any((o) => o.value == _geofenceCooldownH)
                      ? _geofenceCooldownH
                      : 24,
                  decoration: _inputDeco('Tiempo entre notificaciones'),
                  items: _geoCooldownOptions
                      .map((o) => DropdownMenuItem(value: o.value, child: Text(o.label)))
                      .toList(),
                  onChanged: (v) => setState(() => _geofenceCooldownH = v ?? 24),
                ),
              ],
            ],
            const SizedBox(height: 32),

            // ── Feedback ───────────────────────────────────────────────────
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
              ),
            if (_success != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_success!, style: const TextStyle(color: Color(0xFF7CFF3A))),
              ),

            // ── Guardar ────────────────────────────────────────────────────
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 18, height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Guardar'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _proBadge() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white12),
        ),
        child: Row(children: [
          const Icon(Icons.lock_outline, size: 16, color: Colors.white38),
          const SizedBox(width: 8),
          const Expanded(
            child: Text('Solo disponible en Plan Pro',
                style: TextStyle(color: Colors.white54, fontSize: 13)),
          ),
          TextButton(
            onPressed: () {},
            child: const Text('Actualizar →', style: TextStyle(fontSize: 12)),
          ),
        ]),
      );

  Widget _sectionHeader(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(text.toUpperCase(),
            style: const TextStyle(
                fontSize: 11, fontWeight: FontWeight.w700,
                color: Colors.white38, letterSpacing: 1.2)),
      );

  Widget _field(String label, TextEditingController ctrl) => TextField(
        controller: ctrl,
        decoration: _inputDeco(label),
      );

  InputDecoration _inputDeco(String label) => InputDecoration(
        labelText: label,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      );
}
